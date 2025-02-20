module.exports = {
  apps: [{
    name: "chatbot",
    script: "authbind --deep pnpm start",  // 关键修改
    env: {
      NEXTAUTH_URL: "http://34.92.13.95:10808",
      PORT: 80,
      HOST: "0.0.0.0"
    }
  }]
}