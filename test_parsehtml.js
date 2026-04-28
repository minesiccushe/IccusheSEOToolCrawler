import { parseHtml } from './src/crawler/parser.js';
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="robots" content="index, follow">
</head>
<body>
</body>
</html>
`;
const result = parseHtml(html, 'https://example.com/test');
console.log("metaRobotsIndex:", result.metaRobotsIndex);
