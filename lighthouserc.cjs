module.exports = {
  ci: {
    collect: {
      startServerCommand: "bash scripts/start-lighthouse-web.sh",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30000,
      url: ["http://127.0.0.1:5173/", "http://127.0.0.1:5173/videos", "http://127.0.0.1:5173/vod/1"],
      numberOfRuns: 5,
      settings: {
        onlyCategories: ["performance"],
        chromeFlags: "--headless --no-sandbox --disable-dev-shm-usage"
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { aggregationMethod: "median", minScore: 0.8 }],
        "largest-contentful-paint": ["warn", { aggregationMethod: "median", maxNumericValue: 2500 }],
        "total-blocking-time": ["warn", { aggregationMethod: "median", maxNumericValue: 200 }],
        "cumulative-layout-shift": ["warn", { aggregationMethod: "median", maxNumericValue: 0.1 }],
        "resource-summary:script:size": ["error", { aggregationMethod: "median", maxNumericValue: 330000 }],
        "resource-summary:stylesheet:size": ["error", { aggregationMethod: "median", maxNumericValue: 65000 }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: "output/lighthouse"
    }
  }
};
