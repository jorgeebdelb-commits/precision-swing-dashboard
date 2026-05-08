import type { BattlefieldRecord } from "@/lib/intelligence/types/battlefield";
export const defaultSymbols = ["NVDA","TSLA","AMD","MARA","CLSK","META","PLTR","MP"] as const;
export const mockBattlefield: BattlefieldRecord[] = [
  {
    "symbol": "NVDA",
    "price": 1212,
    "swingSignals": {
      "trend": 70,
      "momentum": 68,
      "volume": 60,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 40
    },
    "longSignals": {
      "earnings": 80,
      "revenue": 78,
      "sectorStrength": 72,
      "institutionalQuality": 70,
      "catalysts": 74,
      "valuation": 58,
      "durability": 68,
      "macroResilience": 64
    },
    "swingDirection": "Swing Buy",
    "longDirection": "Long Buy",
    "whale": {
      "confidence": 65,
      "status": "Caution",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Buy Shares",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 55
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "TSLA",
    "price": 193,
    "swingSignals": {
      "trend": 66,
      "momentum": 65,
      "volume": 62,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 44
    },
    "longSignals": {
      "earnings": 75,
      "revenue": 74,
      "sectorStrength": 72,
      "institutionalQuality": 67,
      "catalysts": 74,
      "valuation": 58,
      "durability": 64,
      "macroResilience": 64
    },
    "swingDirection": "Swing Put Opportunity",
    "longDirection": "Long Watch",
    "whale": {
      "confidence": 61,
      "status": "Danger",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Buy Puts",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 51
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "AMD",
    "price": 166,
    "swingSignals": {
      "trend": 62,
      "momentum": 62,
      "volume": 64,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 48
    },
    "longSignals": {
      "earnings": 70,
      "revenue": 70,
      "sectorStrength": 72,
      "institutionalQuality": 64,
      "catalysts": 74,
      "valuation": 58,
      "durability": 60,
      "macroResilience": 64
    },
    "swingDirection": "Swing Watch",
    "longDirection": "Long Buy",
    "whale": {
      "confidence": 57,
      "status": "Stable",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Starter Position",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 47
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "MARA",
    "price": 21.4,
    "swingSignals": {
      "trend": 58,
      "momentum": 59,
      "volume": 66,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 52
    },
    "longSignals": {
      "earnings": 65,
      "revenue": 66,
      "sectorStrength": 72,
      "institutionalQuality": 61,
      "catalysts": 74,
      "valuation": 58,
      "durability": 56,
      "macroResilience": 64
    },
    "swingDirection": "Swing Watch",
    "longDirection": "Long Avoid",
    "whale": {
      "confidence": 53,
      "status": "Caution",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Watch Only",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 43
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "CLSK",
    "price": 16.2,
    "swingSignals": {
      "trend": 54,
      "momentum": 56,
      "volume": 68,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 56
    },
    "longSignals": {
      "earnings": 60,
      "revenue": 62,
      "sectorStrength": 72,
      "institutionalQuality": 58,
      "catalysts": 74,
      "valuation": 58,
      "durability": 52,
      "macroResilience": 64
    },
    "swingDirection": "Swing Avoid",
    "longDirection": "Long Avoid",
    "whale": {
      "confidence": 49,
      "status": "Danger",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "No Trade",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 39
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "META",
    "price": 688,
    "swingSignals": {
      "trend": 50,
      "momentum": 53,
      "volume": 70,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 60
    },
    "longSignals": {
      "earnings": 55,
      "revenue": 58,
      "sectorStrength": 72,
      "institutionalQuality": 55,
      "catalysts": 74,
      "valuation": 58,
      "durability": 48,
      "macroResilience": 64
    },
    "swingDirection": "Swing Buy",
    "longDirection": "Shares Preferred",
    "whale": {
      "confidence": 45,
      "status": "Stable",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Buy Shares",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 35
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "PLTR",
    "price": 41.8,
    "swingSignals": {
      "trend": 46,
      "momentum": 50,
      "volume": 72,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 64
    },
    "longSignals": {
      "earnings": 50,
      "revenue": 54,
      "sectorStrength": 72,
      "institutionalQuality": 52,
      "catalysts": 74,
      "valuation": 58,
      "durability": 44,
      "macroResilience": 64
    },
    "swingDirection": "Swing Watch",
    "longDirection": "LEAP Candidate",
    "whale": {
      "confidence": 41,
      "status": "Caution",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Buy LEAPS",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 31
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  },
  {
    "symbol": "MP",
    "price": 24.3,
    "swingSignals": {
      "trend": 42,
      "momentum": 47,
      "volume": 74,
      "rsi": 55,
      "atr": 5,
      "vwapDelta": 1,
      "breakoutQuality": 62,
      "rejectionRisk": 68
    },
    "longSignals": {
      "earnings": 45,
      "revenue": 50,
      "sectorStrength": 72,
      "institutionalQuality": 49,
      "catalysts": 74,
      "valuation": 58,
      "durability": 40,
      "macroResilience": 64
    },
    "swingDirection": "No Trade",
    "longDirection": "Long Watch",
    "whale": {
      "confidence": 37,
      "status": "Danger",
      "notes": [
        "Mock whale signal"
      ]
    },
    "macro": {
      "confidence": 66,
      "status": "Stable",
      "notes": [
        "Mock macro regime"
      ]
    },
    "politics": {
      "confidence": 58,
      "status": "Caution",
      "notes": [
        "Mock policy risk"
      ]
    },
    "sentiment": {
      "confidence": 61,
      "status": "Stable",
      "notes": [
        "Mock sentiment"
      ]
    },
    "deployment": {
      "mode": "Wait for Pullback",
      "entryZone": "zone",
      "stopZone": "stop",
      "targets": [
        "t1",
        "t2"
      ],
      "expectedMove": "±5%",
      "riskReward": "1:2",
      "aggressiveness": 27
    },
    "alerts": [
      "Defensive rendering enabled"
    ]
  }
];
