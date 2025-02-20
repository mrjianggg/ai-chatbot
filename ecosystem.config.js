module.exports = {
  apps: [{
    name: "chatbot",
    script: "authbind --deep pnpm start",
    interpreter: "none", // 关键！禁止PM2使用默认解释器
    env: {
      NEXTAUTH_URL: "http://34.92.13.95:10808",
      PORT: 80,
      HOST: "0.0.0.0"
    }
  }]
}