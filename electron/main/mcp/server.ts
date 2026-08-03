import http from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpRuntimeStatus } from '../../../src/types/mcp'
import { createMemoryMcpServer } from './tools'
import { registerWriteTools } from './write-tools'

const MCP_ENDPOINT_PATH = '/mcp'
const MCP_LISTEN_HOST = '127.0.0.1'

interface McpServerHandle {
  httpServer: http.Server
  port: number
}

let currentHandle: McpServerHandle | null = null
let runtimeStatus: McpRuntimeStatus = { status: 'stopped', port: null, errorMessage: null }
let operationChain: Promise<unknown> = Promise.resolve()

export function getMcpRuntimeStatus(): McpRuntimeStatus {
  return { ...runtimeStatus }
}

// start/stop 串行化，避免设置页快速切换时产生端口与监听器的竞态
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const nextOperation = operationChain.then(operation, operation)
  operationChain = nextOperation.catch(() => undefined)
  return nextOperation
}

function toStartupErrorMessage(error: unknown, port: number) {
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    return `端口 ${port} 已被占用，请更换端口后重试。`
  }

  if ((error as NodeJS.ErrnoException).code === 'EACCES') {
    return `没有权限监听端口 ${port}，请更换更大的端口。`
  }

  return error instanceof Error ? `MCP 服务启动失败：${error.message}` : 'MCP 服务启动失败，请稍后重试。'
}

// stateless 模式：每个请求创建独立的 server + transport，响应关闭后随即释放
function handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  void (async () => {
    const mcpServer = createMemoryMcpServer()
    registerWriteTools(mcpServer)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    res.on('close', () => {
      void mcpServer.close().catch(() => undefined)
    })

    await mcpServer.connect(transport)
    await transport.handleRequest(req, res)
  })().catch((error: unknown) => {
    console.error('[mcp] 处理 MCP 请求失败：', error)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal Server Error' }))
      return
    }

    res.end()
  })
}

async function stopServerLocked() {
  if (!currentHandle) {
    return
  }

  const handle = currentHandle
  currentHandle = null

  await new Promise<void>((resolve) => {
    handle.httpServer.close(() => resolve())
    // 主动断开残余连接，避免 close 等待 keep-alive 连接导致退出卡住
    handle.httpServer.closeAllConnections()
  })
}

export function startMcpServer(port: number): Promise<McpRuntimeStatus> {
  return enqueue(async () => {
    if (currentHandle && currentHandle.port === port && runtimeStatus.status === 'running') {
      return getMcpRuntimeStatus()
    }

    await stopServerLocked()

    const httpServer = http.createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://${MCP_LISTEN_HOST}`)

      if (requestUrl.pathname !== MCP_ENDPOINT_PATH) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not Found' }))
        return
      }

      handleMcpRequest(req, res)
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const onListenError = (error: Error) => reject(error)
        httpServer.once('error', onListenError)
        httpServer.listen(port, MCP_LISTEN_HOST, () => {
          httpServer.removeListener('error', onListenError)
          resolve()
        })
      })
    } catch (error) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
        httpServer.closeAllConnections()
      })
      runtimeStatus = { status: 'error', port: null, errorMessage: toStartupErrorMessage(error, port) }
      return getMcpRuntimeStatus()
    }

    httpServer.on('error', (error) => {
      console.error('[mcp] MCP 服务运行异常：', error)
      runtimeStatus = { status: 'error', port, errorMessage: toStartupErrorMessage(error, port) }
    })

    currentHandle = { httpServer, port }
    runtimeStatus = { status: 'running', port, errorMessage: null }
    return getMcpRuntimeStatus()
  })
}

export function stopMcpServer(): Promise<McpRuntimeStatus> {
  return enqueue(async () => {
    await stopServerLocked()
    runtimeStatus = { status: 'stopped', port: null, errorMessage: null }
    return getMcpRuntimeStatus()
  })
}
