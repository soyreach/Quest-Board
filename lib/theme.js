// Color themes. Their tokens live in app/globals.css under [data-theme="…"];
// components/ThemePicker.jsx lets people choose, and THEME_SCRIPT applies the
// saved choice before first paint so the page never flashes the wrong colors.

export const THEME_KEY = "qb-theme";

// `swatch` is [chrome, surface, accent], drawn as the picker's little dial.
export const THEMES = [
  { id: "auto", label: "Match device", hint: "Pine by day, Night in dark mode" },
  { id: "pine", label: "Pine", hint: "Forest green, marigold", swatch: ["#12241C", "#F0F1EC", "#E3A43A"] },
  { id: "harbor", label: "Harbor", hint: "Deep navy, coral", swatch: ["#0F1B30", "#EEF1F5", "#F08A5D"] },
  { id: "parchment", label: "Parchment", hint: "Warm paper, walnut", swatch: ["#3A2B1F", "#F3EFE4", "#C8412B"] },
  { id: "night", label: "Night", hint: "Dark, easy on the eyes", swatch: ["#0A0F0D", "#151C19", "#E3B04B"] },
];

export function resolveTheme(choice) {
  if (choice && choice !== "auto") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "pine";
}

export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}")||"auto";var t=c==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"night":"pine"):c;document.documentElement.dataset.theme=t;}catch(e){}})();`;
