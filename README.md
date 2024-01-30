[Wiki documentation](https://github.com/Calculamatrise/antiland/wiki)

### Installation

**Node.js 18.0.0 or newer is required.**

```
npm install antiland
```

### Wiki

More information here.

### Example usage

```js
import antiland, { Client } from "antiland";

// const { Client } = antiland;

const client = new Client();

client.on("ready", function() {
    console.log("Ready!");
});

client.on("message", function(data) {
    console.log(data);
});

client.login("token");

// client.login({
//     username: "Guest",
//     password: "password"
// })
```