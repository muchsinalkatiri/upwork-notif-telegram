import * as cheerio from "cheerio";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import fs from "fs";
import axios from "axios";
import cron from "node-cron";

dotenv.config();

async function sendPesan(databaru) {
  const bot_id = process.env.BOT_ID;
  const chat_id = process.env.CHAT_ID_GRUP_TELEGRAM;

  for (const row of databaru) {
    let pesan = `Keyword: ${row.keyword}\n\nLink: \n${row.url}`;

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot_id}/sendmessage`,
        { chat_id: chat_id, text: pesan, parse_mode: "html" }
      );
      console.log("Pesan terkirim:", response.data);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error; // Optional: rethrow the error if needed
    }
  }
}

async function main() {
  const link = JSON.parse(fs.readFileSync(`link.json`, "utf8"));
  const startTime = Date.now();
  const maxDuration = 60 * 60 * 1000; // 1 jam
  const delay = 60000;

  // Periksa apakah file job.json ada, jika tidak buat file baru
  const jobFilePath = "job.json";
  if (!fs.existsSync(jobFilePath)) {
    fs.writeFileSync(jobFilePath, JSON.stringify([]), "utf8");
  }

  do {
    try {
      const hourNow = new Date().getHours();

      for (const url of link) {
        try {
          const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ["--start-maximized"],
          });
          const page = await browser.newPage();
          await page.goto(url, { waitUntil: "networkidle2" });

          const content = await page.content(); // Mengambil konten HTML dari halaman
          const $ = cheerio.load(content); // Memuat HTML ke dalam Cheerio

          // Membaca ulang data existing jobs dari job.json untuk setiap loop
          let existingJobs = JSON.parse(fs.readFileSync(jobFilePath, "utf8"));

          const data = [];
          $('article[data-ev-label="search_results_impression"]').each(
            (index, element) => {
              const id = $(element).attr("data-ev-job-uid");
              const jobUrl = `https://www.upwork.com${$(element)
                .find("a")
                .attr("href")}`;

              // Hanya lakukan jika id ada
              if (id) {
                // Periksa apakah ID job sudah ada
                const jobExists = existingJobs.some((job) => job.id === id);

                if (!jobExists) {
                  const newJob = {
                    id,
                    url: jobUrl,
                    keyword: getQueryKeyword(url),
                  };
                  data.push(newJob);
                  existingJobs.push(newJob); // Tambahkan job baru ke existingJobs
                }
              }
            }
          );

          // Simpan data baru ke job.json jika ada data baru
          if (data.length > 0) {
            fs.writeFileSync(
              jobFilePath,
              JSON.stringify(existingJobs, null, 2),
              "utf8"
            );
            await sendPesan(data); // Kirim data baru ke fungsi sendPesan
          }

          await browser.close(); // Menutup browser
        } catch (error) {
          console.error("Error fetching HTML:", error);
          continue; // Lanjut ke URL berikutnya
        }

        if (hourNow !== new Date().getHours()) {
          // close looping
          return;
        }
      }
    } catch (error) {
      console.error("Error during main process:", error);
    }

    await sleep(delay);
  } while (Date.now() - startTime <= maxDuration);
}

function getQueryKeyword(url) {
  try {
    const urlObj = new URL(url);
    const queryKeyword = urlObj.searchParams.get("q");
    return queryKeyword ? decodeURIComponent(queryKeyword) : null;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
cron.schedule("0 * * * *", () => {
  console.log("Running job at the start of every hour");
});
