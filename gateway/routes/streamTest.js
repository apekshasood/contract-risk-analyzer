import express from "express";
import busboy from "busboy";
import FormData from "form-data";
import axios from "axios";

const router = express.Router();

router.post("/", (req, res, next) => {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  bb.on("file", (name, file, info) => {
    
    if (info.mimeType !== "application/pdf") {
        file.resume();
        const err = new Error("Only PDF files are allowed");
        err.status = 400;
        return next(err);
      }

    const form = new FormData();
    form.append("file", file, {
      filename: info.filename,
      contentType: info.mimeType,
    });
    file.on("end", () => {
        const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
        console.log(`[stream] ${info.filename} done, RSS ${mb} MB`);
    });

    axios
      .post(`${process.env.AI_ENGINE_URL}/api/audit`, form, {
        headers: form.getHeaders(),
        maxRedirects: 0,
      })
      .then((response) => res.json(response.data))
      .catch(next);
  });

  req.pipe(bb);
});

export default router;