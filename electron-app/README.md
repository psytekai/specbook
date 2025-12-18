# Start

1. Install node dependencies
2. Build native dependencies for correct system arch (post-install, runs automatically via electron builder)
3. Build python package via python installer library (run in npm run dev)

```
npm install
npm run dev # initial run
npm run dev:fast # subsequent runs
```