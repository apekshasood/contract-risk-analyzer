import { readFile } from "node:fs/promises";

const buf = await readFile(process.argv[2]);
const N = 20;
const url = process.argv[3] ?? "http://localhost:3001/api/uploads";

const send = async () => {
  const fd = new FormData();
  fd.append("contract", new Blob([buf], { type: "application/pdf" }), "test.pdf");
  return fetch(url, { method: "POST", body: fd })
    .then((r) => r.status);
};

console.log(await Promise.all(Array.from({ length: N }, send)));