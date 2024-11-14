const { program } = require("commander");
const fs = require("fs");
const path = require("path");
const http = require("http");
const superagent = require("superagent");

program
  .option("-h, --host <server address>", "Server address")
  .option("-p, --port <server port>", "Server port number")
  .option("-c, --cache <path>", "Path to cache directory");

program.parse(process.argv);
const options = program.opts();
const host = options.host;
const port = options.port;
const cache = options.cache;

// Validate required options
if (!host) {
  console.error("Please specify the server address (host).");
  process.exit(1);
}
if (!port) {
  console.error("Please specify the server port number.");
  process.exit(1);
}
if (!cache) {
  console.error("Please specify the path to the cache directory.");
  process.exit(1);
}

// Ensure cache directory exists
if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache, { recursive: true });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = req.url;
  if (url === "/") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET") {
    // Ignore favicon requests
    if (url === "/favicon.ico") {
      res.writeHead(204); // 204 No Content
      res.end();
      return;
    }

    const statusCode = url.slice(1); // Extract status code from URL
    const filePath = path.join(cache, `${statusCode}.jpeg`); // Define cache path

    if (fs.existsSync(filePath)) {
      // Serve cached image
      try {
        const data = await fs.promises.readFile(filePath);
        res.setHeader("Content-Type", "image/jpeg");
        res.writeHead(200);
        res.end(data);
      } catch (error) {
        res.writeHead(500);
        res.end("Error reading file");
      }
    } else {
      // Fetch from http.cat if not in cache and then serve it
      try {
        const response = await superagent.get(`https://http.cat/${statusCode}`);
        const data = response.body;

        await fs.promises.writeFile(filePath, data); // Cache the image
        res.setHeader("Content-Type", "image/jpeg");
        res.writeHead(200);
        res.end(data);
      } catch (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Status Not Found");
      }
    }
  }
  else if (req.method === "PUT") {
    let body = [];
    req.on("data", (chunk) => {
        body.push(chunk);
    });
    req.on("end", async () => {
        const buffer = Buffer.concat(body);
        const filePath = path.join(cache, `${url.slice(1)}.jpeg`);
        try {
            await fs.promises.writeFile(filePath, buffer);
            res.writeHead(201, { "Content-Type": "text/plain" });
            res.end("File created successfully");
        } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Server error");
        }
    });
} else if (req.method === "DELETE") {
  const filePath = path.join(cache, `${url.slice(1)}.jpeg`); // Визначаємо шлях до файлу в кеші

  try {
      // Перевіряємо наявність файлу в кеші
      if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath); // Видаляємо файл
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("File deleted successfully");
      } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("File not found");
      }
  } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error");
  }
}
  else {
    // Handle unsupported methods
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
  }
});

// Start server
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
