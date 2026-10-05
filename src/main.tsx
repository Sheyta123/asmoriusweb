import React from 'react'
import ReactDOM from 'react-dom/client'
import App from "./app/App"
import { initDb } from "./app/lib/db"
import './styles/index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    Đang tải Asmorius...
  </div>,
)

initDb()
  .then(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
  .catch((error) => {
    console.error(error)
    root.render(
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        Không thể khởi tạo dữ liệu. Vui lòng bật lưu trữ trình duyệt và tải lại trang.
      </div>,
    )
  })
