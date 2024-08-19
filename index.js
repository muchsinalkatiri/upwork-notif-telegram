import * as cheerio from "cheerio";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

async function main() {
  dotenv.config();

  const telegramId = process.env.TELEGRAM_ID;
  try {
    const url = "https://www.upwork.com/nx/search/jobs/?q=puppeteer";
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const content = await page.content(); // Mengambil konten HTML dari halaman
    const $ = cheerio.load(content); // Memuat HTML ke dalam Cheerio

    const data = [];
    $('article[data-ev-label="search_results_impression"]').each(
      (index, element) => {
        data.push({
          id: $(element).attr("data-ev-job-uid"),
          url: `https://www.upwork.com${$(element).find("a").attr("href")}`,
        });
      }
    );

    console.log(data);
    await browser.close(); // Menutup browser
  } catch (error) {
    console.error("Error fetching HTML:", error);
  }
}

main();
