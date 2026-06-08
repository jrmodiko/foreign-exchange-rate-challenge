const selector = document.getElementById("currencySelector"); // get the currency selector element
const message = document.getElementById("message"); // get the UI element for status messages
const canvas = document.getElementById("rateCanvas"); // get the chart canvas element
const ctx = canvas.getContext("2d"); // create a 2D canvas drawing context
const API = "https://api.frankfurter.dev/v2"; // exchange rate API base URL
const savedCurrency = sessionStorage.getItem("baseCurrency") || "ZAR"; // load saved currency or default to ZAR
const MAX_BARS = 25; // maximum number of bars displayed in the chart
const PADDING = { left: 88, right: 44, top: 102, bottom: 120 }; // chart padding values
const MIN_BAR_HEIGHT = 20; // minimum bar height to keep bars visible
const LABEL_FONT = "11px Inter, Arial, sans-serif"; // font for labels
const VALUE_FONT = "12px Inter, Arial, sans-serif"; // font for rate values
const AXIS_COLOR = "rgba(15, 23, 42, 0.18)"; // axis stroke color
const GRID_COLOR = "rgba(15, 23, 42, 0.08)"; // grid line color

function setMessage(text, isError = false) {
  message.textContent = text; // change the displayed message text
  message.className = isError ? "message error" : "message"; // apply error styling when needed
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1; // use device pixel ratio for crisp rendering
  const width = canvas.clientWidth; // canvas display width
  const height = canvas.clientHeight; // canvas display height
  canvas.width = width * dpr; // set internal canvas width
  canvas.height = height * dpr; // set internal canvas height
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations to DPR
}

async function loadCurrencies() {
  setMessage("Loading currencies..."); // show loading text while fetching currencies
  const resp = await fetch(`${API}/currencies`); // request currency list
  if (!resp.ok) throw new Error("Could not load currencies."); // handle fetch failure

  const currencies = await resp.json(); // parse the returned JSON
  selector.innerHTML = currencies
    .sort((a, b) => a.iso_code.localeCompare(b.iso_code)) // sort currencies by code
    .map((currency) => `<option value="${currency.iso_code}">${currency.iso_code} - ${currency.name}</option>`) // build options
    .join(""); // join options into a single string

  selector.value = currencies.some((c) => c.iso_code === savedCurrency) ? savedCurrency : "ZAR"; // select saved currency if present
  await loadRates(selector.value); // load rates for the selected currency
}

async function loadRates(base) {
  setMessage("Loading exchange rates..."); // show loading text for rate fetch
  resizeCanvas(); // update canvas size before drawing

  const resp = await fetch(`${API}/rates?base=${encodeURIComponent(base)}`); // fetch exchange rates for chosen base
  if (!resp.ok) throw new Error("Could not load exchange rates."); // handle fetch failure

  const rates = await resp.json(); // parse rate data
  drawChart(rates, base); // render the chart with rate data
  sessionStorage.setItem("baseCurrency", base); // remember selected currency
  setMessage(`Showing top ${Math.min(MAX_BARS, rates.length)} rates for ${base}.`); // update status message
}

function drawChart(rates, base) {
  const topRates = rates.slice().sort((a, b) => b.rate - a.rate).slice(0, MAX_BARS); // sort and limit rates
  if (!topRates.length) {
    setMessage("No exchange rate data available.", true); // inform user when no data exists
    return; // stop if there is nothing to draw
  }

  const width = canvas.clientWidth; // canvas display width
  const height = canvas.clientHeight; // canvas display height
  const chartTop = PADDING.top + 20; // top y position of chart area
  const chartWidth = width - PADDING.left - PADDING.right; // available width for bars
  const chartHeight = height - chartTop - PADDING.bottom; // available height for bars
  const maxRate = Math.max(...topRates.map((item) => item.rate)); // highest rate value for scale
  const step = chartWidth / topRates.length; // horizontal step per bar
  const barWidth = Math.min(34, Math.max(18, step * 0.66)); // compute bar width with limits
  const xOffset = (step - barWidth) / 2; // horizontal centering offset for each bar
  const xAxisY = height - PADDING.bottom; // y position for x-axis
  const date = topRates[0]?.date || ""; // get date from first item if available

  ctx.clearRect(0, 0, width, height); // clear canvas before drawing
  ctx.fillStyle = "#0f172a"; // title text color
  ctx.font = "18px Inter, Arial, sans-serif"; // title font
  ctx.fillText(`Exchange rates for ${base}`, PADDING.left, 30); // draw chart title

  if (date) {
    ctx.font = "12px Inter, Arial, sans-serif"; // date font
    ctx.fillStyle = "#475569"; // date text color
    ctx.fillText(`Date: ${date}`, PADDING.left, 50); // draw date label
  }

  ctx.strokeStyle = GRID_COLOR; // grid line color
  ctx.lineWidth = 1; // grid line width
  const lines = 4; // number of horizontal grid lines
  for (let i = 0; i <= lines; i++) {
    const y = chartTop + (chartHeight / lines) * i; // grid line y position
    ctx.beginPath(); // start grid line path
    ctx.moveTo(PADDING.left, y); // move to left edge
    ctx.lineTo(width - PADDING.right, y); // draw to right edge
    ctx.stroke(); // render the grid line

    ctx.font = LABEL_FONT; // label font
    ctx.fillStyle = "#475569"; // label color
    ctx.textAlign = "right"; // right-align labels
    ctx.textBaseline = "middle"; // vertically center labels
    const labelValue = (maxRate - (maxRate / lines) * i).toFixed(1); // label text value
    ctx.fillText(labelValue, PADDING.left - 10, y); // draw label on left edge
  }

  ctx.strokeStyle = AXIS_COLOR; // axis color
  ctx.lineWidth = 2; // axis width
  ctx.beginPath(); // start y-axis path
  ctx.moveTo(PADDING.left, chartTop); // move to top of y-axis
  ctx.lineTo(PADDING.left, xAxisY); // draw y-axis down to x-axis position
  ctx.stroke(); // render y-axis

  topRates.forEach((item, index) => {
    const x = PADDING.left + index * step + xOffset; // bar left position
    const rawHeight = (item.rate / maxRate) * chartHeight; // proportionate bar height
    const barHeight = Math.max(rawHeight, MIN_BAR_HEIGHT); // enforce minimum height
    const y = xAxisY - barHeight; // top y position of bar
    const valueText = item.rate.toFixed(1); // text display for rate value

    ctx.fillStyle = `hsl(${(index * 18 + 220) % 360}, 78%, 60%)`; // bar color based on index
    ctx.fillRect(x, y, barWidth, barHeight); // draw bar rectangle

    ctx.font = VALUE_FONT; // rate value font
    ctx.textAlign = "center"; // center value text horizontally
    ctx.textBaseline = "bottom"; // align value text at bottom
    ctx.fillStyle = "#0f172a"; // value text color
    ctx.fillText(valueText, x + barWidth / 2, y - 8); // draw value above bar

    ctx.font = LABEL_FONT; // currency label font
    ctx.fillStyle = "#334155"; // currency label color
    ctx.textAlign = "right"; // align label text to right
    ctx.textBaseline = "top"; // align label text to top
    ctx.save(); // save context state before rotating
    ctx.translate(x + barWidth / 2, xAxisY + 8); // move origin to label base point
    ctx.rotate(-Math.PI / 6); // rotate text slightly
    ctx.fillText(item.quote, 0, 0); // draw currency label
    ctx.restore(); // restore context state
  });

  ctx.strokeStyle = "#0f172a"; // x-axis color
  ctx.lineWidth = 2; // x-axis line width
  ctx.beginPath(); // start x-axis path
  ctx.moveTo(PADDING.left, xAxisY); // move to left x-axis point
  ctx.lineTo(width - PADDING.right, xAxisY); // draw x-axis to right edge
  ctx.stroke(); // render x-axis
}

selector.addEventListener("change", (e) => loadRates(e.target.value)); // reload rates when the user changes currency
window.addEventListener("DOMContentLoaded", () => {
  loadCurrencies().catch((err) => setMessage(err.message, true)); // initialize once DOM is ready and show errors
});