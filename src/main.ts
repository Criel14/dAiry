import { createApp } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './style.css'
import App from './App.vue'

dayjs.locale('zh-cn')

createApp(App).mount('#app')
