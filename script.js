const selector = document.getElementById("currencySelector");
const message = document.getElementById("message");
const canvas = document.getElementById("rateCanvas");
const ctx = canvas.getContext("2d");
const API = "https://api.frankfurter.dev/v2";
const savedCurrency = sessionStorage.getItem("baseCurrency") || "ZAR";
const MAX_BARS = 25;
const LEFT_PADDING = 88;
const RIGHT_PADDING = 44;
const TOP_PADDING = 102;
const BOTTOM_PADDING = 120;
const MIN_BAR_HEIGHT = 20;
const LABEL_FONT = "11px Inter, Arial, sans-serif";
const VALUE_FONT = "12px Inter, Arial, sans-serif";
const AXIS_COLOR = "rgba(15, 23, 42, 0.18)";
const GRID_COLOR = "rgba(15, 23, 42, 0.08)";

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "message error" : "message";
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

async function loadCurrencies() {
  setMessage("Loading currencies...");
  const resp = await fetch(`${API}/currencies`);
  if (!resp.ok) throw new Error("Could not load currencies.");

  const currencies = await resp.json();
  const options = currencies
    .sort((a, b) => a.iso_code.localeCompare(b.iso_code))
    .map((currency) => `<option value="${currency.iso_code}">${currency.iso_code} - ${currency.name}</option>`)
    .join("");

  selector.innerHTML = options;
  selector.value = currencies.some((c) => c.iso_code === savedCurrency) ? savedCurrency : "ZAR";
  await loadRates(selector.value);
}

async function loadRates(base) {
  setMessage("Loading exchange rates...");
  resizeCanvas();

  const resp = await fetch(`${API}/rates?base=${encodeURIComponent(base)}`);
  if (!resp.ok) throw new Error("Could not load exchange rates.");

  const rates = await resp.json();
  drawChart(rates, base);
  sessionStorage.setItem("baseCurrency", base);
  setMessage(`Showing top ${Math.min(MAX_BARS, rates.length)} rates for ${base}.`);
}

function drawChart(rates, base) {
  const topRates = rates
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .slice(0, MAX_BARS);

  if (!topRates.length) {
    setMessage("No exchange rate data available.", true);
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const chartTop = TOP_PADDING + 20;
  const chartWidth = width - LEFT_PADDING - RIGHT_PADDING;
  const chartHeight = height - chartTop - BOTTOM_PADDING;
  const maxRate = Math.max(...topRates.map((item) => item.rate));
  const step = chartWidth / topRates.length;
  const barWidth = Math.max(18, Math.min(34, step * 0.66));
  const xOffset = (step - barWidth) / 2;
  const xAxisY = height - BOTTOM_PADDING;
  const date = topRates[0]?.date || "";

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "18px Inter, Arial, sans-serif";
  ctx.fillText(`Exchange rates for ${base}`, LEFT_PADDING, 30);
  if (date) {
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(`Date: ${date}`, LEFT_PADDING, 50);
  }

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const lines = 4;
  for (let i = 0; i <= lines; i++) {
    const y = chartTop + (chartHeight / lines) * i;
    ctx.beginPath();
    ctx.moveTo(LEFT_PADDING, y);
    ctx.lineTo(width - RIGHT_PADDING, y);
    ctx.stroke();

    const labelValue = (maxRate - (maxRate / lines) * i).toFixed(1);
    ctx.font = LABEL_FONT;
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(labelValue, LEFT_PADDING - 10, y);
  }

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LEFT_PADDING, chartTop);
  ctx.lineTo(LEFT_PADDING, xAxisY);
  ctx.stroke();

  const rowEnds = [-Infinity, -Infinity, -Infinity];
  const labelOffset = 10;
  const labelGap = 6;
  const rowSpacing = 18;
  topRates.forEach((item, index) => {
    const x = LEFT_PADDING + index * step + xOffset;
    const rawHeight = (item.rate / maxRate) * chartHeight;
    const barHeight = Math.max(rawHeight, MIN_BAR_HEIGHT);
    const y = xAxisY - barHeight;
    const valueText = item.rate.toFixed(1);

    const hue = (index * 18 + 220) % 360;
    ctx.fillStyle = `hsl(${hue}, 78%, 60%)`;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.font = VALUE_FONT;
    ctx.textAlign = "center";
    const labelX = x + barWidth / 2;
    const labelWidth = ctx.measureText(valueText).width;
    const labelLeft = labelX - labelWidth / 2;
    const labelRight = labelX + labelWidth / 2;
    const baseLabelY = y - labelOffset;
    const row = rowEnds.findIndex((end) => labelLeft > end);
    const labelRow = row === -1 ? 2 : row;
    const labelY = baseLabelY - labelRow * rowSpacing;
    rowEnds[labelRow] = labelRight + labelGap;

    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "bottom";
    ctx.fillText(valueText, labelX, labelY);

    ctx.font = LABEL_FONT;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.save();
    ctx.translate(labelX, xAxisY + 8);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(item.quote, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LEFT_PADDING, xAxisY);
  ctx.lineTo(width - RIGHT_PADDING, xAxisY);
  ctx.stroke();
}

selector.addEventListener("change", (e) => loadRates(e.target.value));
window.addEventListener("DOMContentLoaded", () => {
  loadCurrencies().catch((err) => setMessage(err.message, true));
});