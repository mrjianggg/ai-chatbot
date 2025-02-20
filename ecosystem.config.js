module.exports = {
  apps: [{
    name: "chatbot",
    script: "pnpm start",
    env: {
      NEXTAUTH_URL: "http://34.92.13.95:10808",
      PORT: 80,
      HOST: "0.0.0.0" // 必须添加这个才能外网访问
    }
  }]
}