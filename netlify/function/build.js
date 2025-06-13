// netlify/functions/build.js
const fetch = require("node-fetch");
const { Octokit } = require("@octokit/rest");
const Busboy = require("busboy");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repoOwner = "YOUR_GITHUB_USERNAME";
  const repoName = "YOUR_REPO_NAME";

  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: event.headers });
    const fields = {};
    const files = {};

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on("data", (data) => chunks.push(data));
      file.on("end", () => {
        files[fieldname] = {
          filename,
          content: Buffer.concat(chunks).toString("base64"),
        };
      });
    });

    busboy.on("field", (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on("finish", async () => {
      try {
        const octokit = new Octokit({ auth: githubToken });

        // Create or update the file in your repo
        const path = `uploads/${Date.now()}-${files.zip.filename}`;
        await octokit.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo: repoName,
          path,
          message: `Upload ${files.zip.filename}`,
          content: files.zip.content,
          committer: {
            name: "Netlify Bot",
            email: "bot@netlify.com",
          },
          author: {
            name: "Uploader",
            email: "uploader@site.com",
          },
        });

        // Trigger GitHub Action by pushing this commit
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: "Uploaded successfully. APK will be built.",
            uploadedPath: path,
            downloadUrl: `https://github.com/${repoOwner}/${repoName}/actions`,
          }),
        });
      } catch (error) {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: error.message }),
        });
      }
    });

    busboy.end(Buffer.from(event.body, "base64"));
  });
};
