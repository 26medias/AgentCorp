```
const client = new MessengerClient('ws://localhost:8080', 'my_username')
client.onDirectMessage((message, from) => {
    console.log("DM:", {message, from})
})
client.onChannelMessage((message, from, channel) => {
    console.log("Channel:", {message, from, channel})
})
client.DM("username", "message")
client.send("channel", "message")
```