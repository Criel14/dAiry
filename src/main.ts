import { createApp } from 'vue'
import dayjs from 'dayjs'
import { addCollection } from '@iconify/vue'
import { icons as lucideIcons } from '@iconify-json/lucide'
import 'dayjs/locale/zh-cn'
import './style.css'
import App from './App.vue'

dayjs.locale('zh-cn')
addCollection(lucideIcons)

createApp(App).mount('#app')
