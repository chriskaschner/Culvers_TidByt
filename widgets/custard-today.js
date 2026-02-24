// Custard Today -- Scriptable widget for iOS
// Shows today's Flavor of the Day from Custard Calendar.
//
// Setup:
//   1. Install Scriptable from the App Store
//   2. Create a new script, paste this file
//   3. Add a Scriptable widget to your home screen
//   4. Long-press the widget > Edit Widget > choose this script
//   5. Set Parameter to your store slug (e.g. "mt-horeb")
//      Find your slug at custard.chriskaschner.com/widget.html
//
// Small widget:  Today's flavor + store + rarity badge
// Medium widget: 3-day forecast with flavor names and dates

var API_BASE = "https://custard-calendar.chris-kaschner.workers.dev/api/v1";
var slug = (args.widgetParameter || "mt-horeb").trim();

var BRAND_COLORS = {
  "Culver's": { bg: "#005696", text: "#FFFFFF" },
  "Kopp's":   { bg: "#1a1a1a", text: "#FFFFFF" },
  "Gille's":  { bg: "#EBCC35", text: "#1a1a1a" },
  "Hefner's": { bg: "#93BE46", text: "#1a1a1a" },
  "Kraverz":  { bg: "#CE742D", text: "#FFFFFF" },
  "Oscar's":  { bg: "#BC272C", text: "#FFFFFF" }
};

var RARITY_COLORS = {
  "Ultra Rare": "#9C27B0",
  "Rare":       "#E65100",
  "Uncommon":   "#1565C0",
  "Common":     "#757575"
};

// Fetch today's flavor
async function fetchToday() {
  var url = API_BASE + "/today?slug=" + encodeURIComponent(slug);
  var req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

// Fetch multi-day flavors
async function fetchFlavors() {
  var url = API_BASE + "/flavors?slug=" + encodeURIComponent(slug);
  var req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

function formatDate(dateStr) {
  var d = new Date(dateStr + "T12:00:00");
  var today = new Date();
  today.setHours(12, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();
}

function brandStyle(brandName) {
  return BRAND_COLORS[brandName] || BRAND_COLORS["Culver's"];
}

// --- Small Widget: Today's flavor ---

async function buildSmall() {
  var data = await fetchToday();
  var style = brandStyle(data.brand);
  var w = new ListWidget();

  var gradient = new LinearGradient();
  gradient.locations = [0, 1];
  gradient.colors = [new Color(style.bg), new Color(style.bg, 0.85)];
  w.backgroundGradient = gradient;

  w.setPadding(12, 14, 12, 14);

  // Store name (short form)
  var storeText = w.addText(data.brand || "Custard");
  storeText.font = Font.boldSystemFont(11);
  storeText.textColor = new Color(style.text, 0.7);

  w.addSpacer(4);

  // Flavor name
  var flavorText = w.addText(data.flavor || "No flavor listed");
  flavorText.font = Font.boldSystemFont(18);
  flavorText.textColor = new Color(style.text);
  flavorText.minimumScaleFactor = 0.6;
  flavorText.lineLimit = 2;

  w.addSpacer(4);

  // Date
  var dateLabel = formatDate(data.date);
  var dateText = w.addText(dateLabel);
  dateText.font = Font.mediumSystemFont(11);
  dateText.textColor = new Color(style.text, 0.7);

  w.addSpacer(null);

  // Rarity badge
  if (data.rarity && data.rarity.label) {
    var badge = w.addText(data.rarity.label.toUpperCase());
    badge.font = Font.boldMonospacedSystemFont(9);
    var rarityColor = RARITY_COLORS[data.rarity.label] || RARITY_COLORS["Common"];
    badge.textColor = new Color(rarityColor);
  }

  return w;
}

// --- Medium Widget: 3-day forecast ---

async function buildMedium() {
  var data = await fetchFlavors();
  var flavors = (data.flavors || []);

  // Filter to today and future
  var todayStr = new Date().toISOString().slice(0, 10);
  var upcoming = flavors.filter(function(f) { return f.date >= todayStr; }).slice(0, 3);

  // Determine brand from store name
  var brandName = "Culver's";
  var storeName = data.name || "";
  var brandKeys = Object.keys(BRAND_COLORS);
  for (var bi = 0; bi < brandKeys.length; bi++) {
    if (storeName.indexOf(brandKeys[bi]) !== -1) {
      brandName = brandKeys[bi];
      break;
    }
  }
  var style = brandStyle(brandName);

  var w = new ListWidget();
  var gradient = new LinearGradient();
  gradient.locations = [0, 1];
  gradient.colors = [new Color(style.bg), new Color(style.bg, 0.85)];
  w.backgroundGradient = gradient;
  w.setPadding(12, 14, 12, 14);

  // Header
  var header = w.addText(brandName + " -- 3-Day Forecast");
  header.font = Font.boldSystemFont(11);
  header.textColor = new Color(style.text, 0.7);

  w.addSpacer(6);

  if (upcoming.length === 0) {
    var noData = w.addText("No upcoming flavors listed");
    noData.font = Font.systemFont(14);
    noData.textColor = new Color(style.text, 0.6);
  } else {
    for (var i = 0; i < upcoming.length; i++) {
      var f = upcoming[i];
      var row = w.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();

      var dateCol = row.addText(formatDate(f.date));
      dateCol.font = Font.mediumSystemFont(11);
      dateCol.textColor = new Color(style.text, 0.6);
      dateCol.lineLimit = 1;
      row.addSpacer(8);

      var flavorCol = row.addText(f.title || "TBD");
      flavorCol.font = Font.boldSystemFont(14);
      flavorCol.textColor = new Color(style.text);
      flavorCol.lineLimit = 1;
      flavorCol.minimumScaleFactor = 0.7;

      if (i < upcoming.length - 1) w.addSpacer(4);
    }
  }

  w.addSpacer(null);

  // Store location
  var loc = w.addText(data.address || slug);
  loc.font = Font.systemFont(9);
  loc.textColor = new Color(style.text, 0.5);
  loc.lineLimit = 1;

  return w;
}

// --- Entry point ---

var widgetSize = (config.widgetFamily || "small");
var widget;

if (widgetSize === "medium" || widgetSize === "large") {
  widget = await buildMedium();
} else {
  widget = await buildSmall();
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Preview when running in-app
  if (widgetSize === "medium") {
    widget.presentMedium();
  } else {
    widget.presentSmall();
  }
}

Script.complete();
