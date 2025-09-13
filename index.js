import { execSync } from "child_process";
import fetch from "node-fetch";

const repoFull = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repoFull.split("/");
const ref = process.env.GITHUB_REF;
const match = ref.match(/refs\/pull\/(\d+)\/merge/);
const prNumber = match ? match[1] : null;

if (!prNumber) {
  console.error("Could not detect PR number");
  process.exit(1);
}

const baseRef = process.env.GITHUB_BASE_REF;
const diff = execSync(
  `git fetch origin ${baseRef} && git diff origin/${baseRef}...HEAD`
).toString();

const openaiKey = process.env.INPUT_OPENAI_API_KEY;
const githubToken = process.env.INPUT_GITHUB_TOKEN;

// Ask OpenAI for review
const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${openaiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert AI code reviewer. Review for bugs, security issues, maintainability, and improvements.",
      },
      { role: "user", content: `Review this PR diff:\n${diff}` },
    ],
  }),
});

const aiData = await aiRes.json();
const review = aiData.choices?.[0]?.message?.content || "⚠️ AI review failed.";

// Post as PR comment
await fetch(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: review }),
  }
);

console.log(`✅ AI Review posted on PR #${prNumber}`);
