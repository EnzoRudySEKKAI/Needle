import type { OntologyDocument } from './types'

export const ATLAS_TOWER = {
  "schemaVersion": 9,
  "id": "atlas-tower",
  "name": "Atlas Tower",
  "version": "v1.0",
  "description": "How fleeting notes become a garden of trusted knowledge.",
  "structureType": "campus",
  "createdAt": "2026-08-22T09:15:31.240Z",
  "updatedAt": "2026-08-23T03:00:46.110Z",
  "floors": [
    {
      "id": "capture-floor",
      "name": "Capture",
      "groupFlagPositions": {}
    },
    {
      "id": "synthesize-floor",
      "name": "Synthesize",
      "groupFlagPositions": {}
    },
    {
      "id": "publish-floor",
      "name": "Publish",
      "groupFlagPositions": {}
    }
  ],
  "groups": [
    {
      "id": "raw",
      "name": "Raw traces",
      "description": "Where thoughts are caught before they fade."
    },
    {
      "id": "synthesis",
      "name": "Synthesis",
      "description": "Where scattered notes become connected maps."
    },
    {
      "id": "library",
      "name": "Living library",
      "description": "Where knowledge is curated and kept alive."
    },
    {
      "id": "readers",
      "name": "Readers & writers",
      "description": "People who read, write and return."
    }
  ],
  "nodes": [
    {
      "id": "inbox",
      "code": "IB",
      "name": "Inbox",
      "groupId": "raw",
      "floorId": "capture-floor",
      "size": "m",
      "position": {
        "gx": -6,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-ib-1",
          "key": "intake",
          "value": "triage daily"
        }
      ],
      "whatItDoes": "Collects every raw capture into one inbox before anything is judged.",
      "howItsBuilt": "Everything lands untagged; triage keeps capture separate from curation."
    },
    {
      "id": "fleeting",
      "code": "FL",
      "name": "Fleeting note",
      "groupId": "raw",
      "floorId": "capture-floor",
      "size": "s",
      "position": {
        "gx": 0,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-fl-1",
          "key": "lifetime",
          "value": "48 hours"
        }
      ],
      "whatItDoes": "A quick note taken before the context dissolves.",
      "howItsBuilt": "Meant to be lightweight so capture never waits for structure."
    },
    {
      "id": "recorder",
      "code": "RC",
      "name": "Field recorder",
      "groupId": "raw",
      "floorId": "capture-floor",
      "size": "l",
      "position": {
        "gx": 4.5,
        "gy": 0
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-rc-1",
          "key": "media",
          "value": "audio + photo"
        }
      ],
      "whatItDoes": "Keeps audio, photo and location together as one field trace.",
      "howItsBuilt": "Media stays linked to time and place so later synthesis can return to the source."
    },
    {
      "id": "canvas",
      "code": "CV",
      "name": "Canvas",
      "groupId": "synthesis",
      "floorId": "synthesize-floor",
      "size": "m",
      "position": {
        "gx": -6,
        "gy": 8
      },
      "faceTexture": "plain",
      "archetypeOverride": "podium-tower",
      "properties": [
        {
          "id": "p-cv-1",
          "key": "board",
          "value": "infinite"
        }
      ],
      "whatItDoes": "Spreads notes on a surface where proximity suggests relationships.",
      "howItsBuilt": "Position is meaning; clusters form before any explicit link is declared."
    },
    {
      "id": "graph",
      "code": "GR",
      "name": "Link graph",
      "groupId": "synthesis",
      "floorId": "synthesize-floor",
      "size": "l",
      "position": {
        "gx": 0,
        "gy": 8
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-gr-1",
          "key": "links",
          "value": "bidirectional"
        }
      ],
      "whatItDoes": "Turns spatial clusters into durable links between concepts.",
      "howItsBuilt": "Every link is reversible, so maps grow without forcing a hierarchy."
    },
    {
      "id": "queue",
      "code": "RQ",
      "name": "Review queue",
      "groupId": "synthesis",
      "floorId": "synthesize-floor",
      "size": "s",
      "position": {
        "gx": 5.5,
        "gy": 8
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-rq-1",
          "key": "review",
          "value": "weekly"
        }
      ],
      "whatItDoes": "Holds emerging maps until they are questioned and tightened.",
      "howItsBuilt": "A heartbeat review keeps the garden from overgrowing while preserving serendipity."
    },
    {
      "id": "garden",
      "code": "GD",
      "name": "Garden Atlas",
      "groupId": "library",
      "floorId": "publish-floor",
      "size": "xl",
      "position": {
        "gx": -6,
        "gy": 16
      },
      "faceTexture": "hatched",
      "archetypeOverride": "slab-stack",
      "properties": [
        {
          "id": "p-gd-1",
          "key": "evergreen",
          "value": "true"
        }
      ],
      "whatItDoes": "The long-lived atlas where maps become readable essays.",
      "howItsBuilt": "Garden notes are tended, not just stored; freshness is tracked alongside content."
    },
    {
      "id": "studio",
      "code": "ST",
      "name": "Writing studio",
      "groupId": "library",
      "floorId": "publish-floor",
      "size": "m",
      "position": {
        "gx": 3.5,
        "gy": 16.599999999999998
      },
      "faceTexture": "plain",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-st-1",
          "key": "tool",
          "value": "long-form"
        }
      ],
      "whatItDoes": "Turns a garden path into a finished piece others can follow.",
      "howItsBuilt": "Studio drafts cite the exact garden nodes they grew from."
    },
    {
      "id": "feed",
      "code": "FE",
      "name": "Public feed",
      "groupId": "readers",
      "floorId": "publish-floor",
      "size": "s",
      "position": {
        "gx": 11.5,
        "gy": 17.276
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-fe-1",
          "key": "cadence",
          "value": "as written"
        }
      ],
      "whatItDoes": "Publishes garden excerpts where readers can find them.",
      "howItsBuilt": "Feed items stay linked back to the garden so readers can go deeper."
    },
    {
      "id": "commons",
      "code": "CM",
      "name": "Commons",
      "groupId": "readers",
      "floorId": "publish-floor",
      "size": "m",
      "position": {
        "gx": 11.5,
        "gy": 23.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "bridge",
      "properties": [
        {
          "id": "p-cm-1",
          "key": "replies",
          "value": "linked notes"
        }
      ],
      "whatItDoes": "Where readers annotate, question and return new traces.",
      "howItsBuilt": "Replies are modelled as first-class notes so the commons can feed the next capture."
    }
  ],
  "relations": [
    {
      "id": "r-fleeting-inbox",
      "from": "fleeting",
      "to": "inbox",
      "kind": "flow",
      "label": "quick capture"
    },
    {
      "id": "r-recorder-inbox",
      "from": "recorder",
      "to": "inbox",
      "kind": "data",
      "label": "field trace"
    },
    {
      "id": "r-inbox-canvas",
      "from": "inbox",
      "to": "canvas",
      "kind": "flow",
      "label": "triage to canvas"
    },
    {
      "id": "r-canvas-graph",
      "from": "canvas",
      "to": "graph",
      "kind": "flow",
      "label": "spatial links"
    },
    {
      "id": "r-graph-queue",
      "from": "graph",
      "to": "queue",
      "kind": "support",
      "label": "candidate maps"
    },
    {
      "id": "r-queue-garden",
      "from": "queue",
      "to": "garden",
      "kind": "flow",
      "label": "tended map"
    },
    {
      "id": "r-garden-studio",
      "from": "garden",
      "to": "studio",
      "kind": "support",
      "label": "source atlas"
    },
    {
      "id": "r-studio-feed",
      "from": "studio",
      "to": "feed",
      "kind": "flow",
      "label": "published piece"
    },
    {
      "id": "r-feed-commons",
      "from": "feed",
      "to": "commons",
      "kind": "flow",
      "label": "reading"
    },
    {
      "id": "r-commons-fleeting",
      "from": "commons",
      "to": "fleeting",
      "kind": "retry",
      "label": "new spark"
    }
  ],
  "flows": [
    {
      "id": "capture-thought",
      "name": "Capture a thought",
      "payload": "a fleeting note",
      "summary": "Follows a quick note from spark to canvas.",
      "stages": [
        {
          "id": "capture-0",
          "traversals": [
            {
              "id": "capture-0-a",
              "relationId": "r-fleeting-inbox",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "capture-1",
          "traversals": [
            {
              "id": "capture-1-a",
              "relationId": "r-inbox-canvas",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "capture-2",
          "traversals": [
            {
              "id": "capture-2-a",
              "relationId": "r-canvas-graph",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "grow-garden",
      "name": "Grow the garden",
      "payload": "a map",
      "summary": "Turns canvas clusters into a tended garden entry.",
      "stages": [
        {
          "id": "grow-0",
          "traversals": [
            {
              "id": "grow-0-a",
              "relationId": "r-canvas-graph",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "grow-1",
          "traversals": [
            {
              "id": "grow-1-a",
              "relationId": "r-graph-queue",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "grow-2",
          "traversals": [
            {
              "id": "grow-2-a",
              "relationId": "r-queue-garden",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "grow-3",
          "traversals": [
            {
              "id": "grow-3-a",
              "relationId": "r-garden-studio",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "publish-learn",
      "name": "Publish and learn",
      "payload": "a published essay",
      "summary": "Publishes a studio piece and follows its echo back to a new spark.",
      "stages": [
        {
          "id": "publish-0",
          "traversals": [
            {
              "id": "publish-0-a",
              "relationId": "r-studio-feed",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "publish-1",
          "traversals": [
            {
              "id": "publish-1-a",
              "relationId": "r-feed-commons",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "publish-2",
          "traversals": [
            {
              "id": "publish-2-a",
              "relationId": "r-commons-fleeting",
              "direction": "forward"
            }
          ]
        }
      ]
    }
  ]
} as const;

export const HARBOR_CAMPUS = {
  "schemaVersion": 9,
  "id": "harbor-campus",
  "name": "Harbor Campus",
  "version": "v1.0",
  "description": "How a harbor university turns people, places and practice into learning.",
  "structureType": "campus",
  "createdAt": "2026-08-22T09:15:31.240Z",
  "updatedAt": "2026-08-23T03:00:46.110Z",
  "floors": [
    {
      "id": "quad-floor",
      "name": "Central Quad",
      "groupFlagPositions": {}
    },
    {
      "id": "labs-floor",
      "name": "Research Terraces",
      "groupFlagPositions": {}
    },
    {
      "id": "harbor-floor",
      "name": "Harbor & City",
      "groupFlagPositions": {}
    }
  ],
  "groups": [
    {
      "id": "learning",
      "name": "Learning studios",
      "description": "Where cohorts learn by doing."
    },
    {
      "id": "research",
      "name": "Research yards",
      "description": "Where questions become instruments."
    },
    {
      "id": "life",
      "name": "Campus life",
      "description": "Where living makes learning durable."
    },
    {
      "id": "city",
      "name": "Harbor city",
      "description": "The city that teaches the campus."
    }
  ],
  "nodes": [
    {
      "id": "lecture",
      "code": "LH",
      "name": "Lecture hall",
      "groupId": "learning",
      "floorId": "quad-floor",
      "size": "l",
      "position": {
        "gx": -12,
        "gy": 0.2679999999999998
      },
      "faceTexture": "hatched",
      "archetypeOverride": "stepped-pyramid",
      "properties": [
        {
          "id": "p-lh-1",
          "key": "capacity",
          "value": "180"
        }
      ],
      "whatItDoes": "Hosts the shared inquiry a cohort returns to each week.",
      "howItsBuilt": "A stepped form makes every voice reachable without amplifying only the front."
    },
    {
      "id": "library",
      "code": "LB",
      "name": "Library",
      "groupId": "learning",
      "floorId": "quad-floor",
      "size": "xl",
      "position": {
        "gx": -3,
        "gy": 0
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-lb-1",
          "key": "holdings",
          "value": "120k volumes"
        }
      ],
      "whatItDoes": "Keeps the durable record a studio can cite and contest.",
      "howItsBuilt": "Books and instruments sit side by side so theory meets its tools."
    },
    {
      "id": "studio",
      "code": "SO",
      "name": "Design studio",
      "groupId": "learning",
      "floorId": "quad-floor",
      "size": "m",
      "position": {
        "gx": -6,
        "gy": -8.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "fin-row",
      "properties": [
        {
          "id": "p-so-1",
          "key": "crit",
          "value": "weekly"
        }
      ],
      "whatItDoes": "Turns briefs into models, then models into arguments.",
      "howItsBuilt": "Fin rows keep group tables separate while sharing one common critique wall."
    },
    {
      "id": "cafe",
      "code": "CF",
      "name": "Quad café",
      "groupId": "life",
      "floorId": "quad-floor",
      "size": "s",
      "position": {
        "gx": 9.5,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-cf-1",
          "key": "hours",
          "value": "7am-9pm"
        }
      ],
      "whatItDoes": "Feeds the informal debates where studio ideas are first tested.",
      "howItsBuilt": "A small anchor that makes the quad inhabitable beyond class hours."
    },
    {
      "id": "wetlab",
      "code": "WL",
      "name": "Wet lab",
      "groupId": "research",
      "floorId": "labs-floor",
      "size": "l",
      "position": {
        "gx": -7,
        "gy": 8
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-wl-1",
          "key": "safety",
          "value": "BSL-2"
        }
      ],
      "whatItDoes": "Tests harbor water, tissue and soil in controlled conditions.",
      "howItsBuilt": "Bench logic mirrors the harbor sampling routes so field and lab stay comparable."
    },
    {
      "id": "fab",
      "code": "FB",
      "name": "Fabrication yard",
      "groupId": "research",
      "floorId": "labs-floor",
      "size": "m",
      "position": {
        "gx": -7.4079999999999995,
        "gy": 14.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-fb-1",
          "key": "tools",
          "value": "CNC, print, weld"
        }
      ],
      "whatItDoes": "Builds the instruments that field questions require.",
      "howItsBuilt": "A courtyard keeps dust isolated while keeping the build visible to passers-by."
    },
    {
      "id": "observatory",
      "code": "OB",
      "name": "Observatory",
      "groupId": "research",
      "floorId": "labs-floor",
      "size": "m",
      "position": {
        "gx": 0,
        "gy": 7.6739999999999995
      },
      "faceTexture": "plain",
      "archetypeOverride": "twin-towers",
      "properties": [
        {
          "id": "p-ob-1",
          "key": "focus",
          "value": "tides + light"
        }
      ],
      "whatItDoes": "Watches the harbor across seasons so change can be compared.",
      "howItsBuilt": "Twin optics let ground and sky readings share one calibration log."
    },
    {
      "id": "vault",
      "code": "DV",
      "name": "Data vault",
      "groupId": "research",
      "floorId": "labs-floor",
      "size": "s",
      "position": {
        "gx": 0.6579999999999999,
        "gy": 15
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-dv-1",
          "key": "retention",
          "value": "10 years"
        }
      ],
      "whatItDoes": "Keeps time-series and provenance for every field dataset.",
      "howItsBuilt": "Datasets are append-only; corrections are new entries that reference what they fix."
    },
    {
      "id": "pier",
      "code": "PC",
      "name": "Pier classroom",
      "groupId": "city",
      "floorId": "harbor-floor",
      "size": "m",
      "position": {
        "gx": -0.4079999999999999,
        "gy": 7
      },
      "faceTexture": "plain",
      "archetypeOverride": "bridge",
      "properties": [
        {
          "id": "p-pc-1",
          "key": "tide",
          "value": "open in all"
        }
      ],
      "whatItDoes": "Teaches with the harbor underfoot rather than on a slide.",
      "howItsBuilt": "A bridge form marks it as a deliberate crossing between city and campus."
    },
    {
      "id": "boatyard",
      "code": "BY",
      "name": "Boatyard",
      "groupId": "city",
      "floorId": "harbor-floor",
      "size": "l",
      "position": {
        "gx": 0,
        "gy": 16
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-by-1",
          "key": "hulls",
          "value": "6 active"
        }
      ],
      "whatItDoes": "Maintains the small boats that carry learning onto the water.",
      "howItsBuilt": "Maintenance logs are teaching tools as much as operational records."
    },
    {
      "id": "market",
      "code": "MK",
      "name": "Harbor market",
      "groupId": "city",
      "floorId": "harbor-floor",
      "size": "s",
      "position": {
        "gx": 5.5,
        "gy": 16
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-mk-1",
          "key": "open",
          "value": "Tue Sat"
        }
      ],
      "whatItDoes": "Connects harbor work to the food web the campus studies.",
      "howItsBuilt": "Stalls are small so many livelihoods remain visible in one view."
    },
    {
      "id": "dorms",
      "code": "DM",
      "name": "Harbor dorms",
      "groupId": "life",
      "floorId": "harbor-floor",
      "size": "xl",
      "position": {
        "gx": 13,
        "gy": 14.704
      },
      "faceTexture": "hatched",
      "archetypeOverride": "slab-stack",
      "properties": [
        {
          "id": "p-dm-1",
          "key": "beds",
          "value": "240"
        }
      ],
      "whatItDoes": "Houses the cohort close enough to return to the harbor daily.",
      "howItsBuilt": "A stacked slab keeps the living block compact so the harbor edge stays public."
    }
  ],
  "relations": [
    {
      "id": "r-lecture-library",
      "from": "lecture",
      "to": "library",
      "kind": "support",
      "label": "reading lists"
    },
    {
      "id": "r-library-studio",
      "from": "library",
      "to": "studio",
      "kind": "data",
      "label": "collection scans"
    },
    {
      "id": "r-studio-lecture",
      "from": "studio",
      "to": "lecture",
      "kind": "flow",
      "label": "studio provocation"
    },
    {
      "id": "r-library-vault",
      "from": "library",
      "to": "vault",
      "kind": "flow",
      "label": "catalogued datasets"
    },
    {
      "id": "r-observatory-vault",
      "from": "observatory",
      "to": "vault",
      "kind": "data",
      "label": "time series"
    },
    {
      "id": "r-wetlab-fab",
      "from": "wetlab",
      "to": "fab",
      "kind": "flow",
      "label": "instrument brief"
    },
    {
      "id": "r-fab-boatyard",
      "from": "fab",
      "to": "boatyard",
      "kind": "flow",
      "label": "custom hull fittings"
    },
    {
      "id": "r-vault-pier",
      "from": "vault",
      "to": "pier",
      "kind": "data",
      "label": "harbor archive"
    },
    {
      "id": "r-boatyard-pier",
      "from": "boatyard",
      "to": "pier",
      "kind": "support",
      "label": "boats ready"
    },
    {
      "id": "r-pier-market",
      "from": "pier",
      "to": "market",
      "kind": "flow",
      "label": "field samples"
    },
    {
      "id": "r-market-dorms",
      "from": "market",
      "to": "dorms",
      "kind": "data",
      "label": "staples and stories"
    },
    {
      "id": "r-dorms-cafe",
      "from": "dorms",
      "to": "cafe",
      "kind": "retry",
      "label": "nightly return"
    },
    {
      "id": "r-cafe-studio",
      "from": "cafe",
      "to": "studio",
      "kind": "support",
      "label": "overheard critiques"
    }
  ],
  "flows": [
    {
      "id": "field-to-archive",
      "name": "Field to archive",
      "payload": "a harbor dataset",
      "summary": "Carries harbor observations into the catalogued archive.",
      "stages": [
        {
          "id": "field-0",
          "traversals": [
            {
              "id": "field-0-a",
              "relationId": "r-observatory-vault",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "field-1",
          "traversals": [
            {
              "id": "field-1-a",
              "relationId": "r-library-vault",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "field-2",
          "traversals": [
            {
              "id": "field-2-a",
              "relationId": "r-vault-pier",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "build-launch",
      "name": "Build and launch",
      "payload": "a field instrument",
      "summary": "From wet-lab question to a boat that can chase it.",
      "stages": [
        {
          "id": "build-0",
          "traversals": [
            {
              "id": "build-0-a",
              "relationId": "r-wetlab-fab",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "build-1",
          "traversals": [
            {
              "id": "build-1-a",
              "relationId": "r-fab-boatyard",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "build-2",
          "traversals": [
            {
              "id": "build-2-a",
              "relationId": "r-boatyard-pier",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "build-3",
          "traversals": [
            {
              "id": "build-3-a",
              "relationId": "r-pier-market",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "live-learn",
      "name": "Live and learn",
      "payload": "a cohort week",
      "summary": "A loop where living, making and studying keep feeding each other.",
      "stages": [
        {
          "id": "live-0",
          "traversals": [
            {
              "id": "live-0-a",
              "relationId": "r-library-studio",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "live-1",
          "traversals": [
            {
              "id": "live-1-a",
              "relationId": "r-studio-lecture",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "live-2",
          "traversals": [
            {
              "id": "live-2-a",
              "relationId": "r-lecture-library",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "live-3",
          "traversals": [
            {
              "id": "live-3-a",
              "relationId": "r-dorms-cafe",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "live-4",
          "traversals": [
            {
              "id": "live-4-a",
              "relationId": "r-cafe-studio",
              "direction": "forward"
            }
          ]
        }
      ]
    }
  ]
} as const;

export const AURORA_LINER = {
  "schemaVersion": 9,
  "id": "aurora-liner",
  "name": "Aurora Liner",
  "version": "v1.0",
  "description": "How a floating city keeps its guests cared for while staying on course.",
  "structureType": "cruise-ship",
  "createdAt": "2026-08-22T09:15:31.240Z",
  "updatedAt": "2026-08-23T03:00:46.110Z",
  "floors": [
    {
      "id": "lower-deck",
      "name": "Lower deck — Engine & stores",
      "groupFlagPositions": {}
    },
    {
      "id": "service-deck",
      "name": "Service deck — Crew & logistics",
      "groupFlagPositions": {}
    },
    {
      "id": "main-deck",
      "name": "Main deck — Hospitality",
      "groupFlagPositions": {}
    },
    {
      "id": "bridge-deck",
      "name": "Bridge deck — Navigation & calm",
      "groupFlagPositions": {}
    }
  ],
  "groups": [
    {
      "id": "engine",
      "name": "Engine & stores",
      "description": "Where energy, cold and dry stores stay reliable."
    },
    {
      "id": "crew",
      "name": "Crew & logistics",
      "description": "Where hands keep the ship ready."
    },
    {
      "id": "hospitality",
      "name": "Hospitality",
      "description": "Where guests eat, swim and gather."
    },
    {
      "id": "guests",
      "name": "Guests & horizon",
      "description": "Where the voyage is felt."
    },
    {
      "id": "command",
      "name": "Command & navigation",
      "description": "Where course, weather and calm are held."
    }
  ],
  "nodes": [
    {
      "id": "engine-room",
      "code": "ER",
      "name": "Engine room",
      "groupId": "engine",
      "floorId": "lower-deck",
      "size": "xl",
      "position": {
        "gx": -6,
        "gy": 0
      },
      "faceTexture": "hatched",
      "archetypeOverride": "tower",
      "properties": [
        {
          "id": "p-er-1",
          "key": "output",
          "value": "12 MW"
        }
      ],
      "whatItDoes": "Pushes the ship forward and keeps lights and water on.",
      "howItsBuilt": "All power routes are visible on one board so failures trace without hunting."
    },
    {
      "id": "fuel",
      "code": "FS",
      "name": "Fuel store",
      "groupId": "engine",
      "floorId": "lower-deck",
      "size": "m",
      "position": {
        "gx": 2,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-fs-1",
          "key": "range",
          "value": "14 days"
        }
      ],
      "whatItDoes": "Holds and conditions fuel so the engine never drinks dirty.",
      "howItsBuilt": "Tanks are baffled and sampled so motion never hides contamination."
    },
    {
      "id": "cold",
      "code": "CS",
      "name": "Cold stores",
      "groupId": "engine",
      "floorId": "lower-deck",
      "size": "s",
      "position": {
        "gx": 9,
        "gy": 1
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-cs-1",
          "key": "temp",
          "value": "-24 to 4 °C"
        }
      ],
      "whatItDoes": "Keeps provisions safe before the galley calls for them.",
      "howItsBuilt": "Zones are sealed separately so one thaw cannot spoil the rest."
    },
    {
      "id": "galley",
      "code": "GA",
      "name": "Galley",
      "groupId": "crew",
      "floorId": "service-deck",
      "size": "m",
      "position": {
        "gx": -10,
        "gy": 15.329999999999998
      },
      "faceTexture": "plain",
      "archetypeOverride": "fin-row",
      "properties": [
        {
          "id": "p-ga-1",
          "key": "covers",
          "value": "900 per service"
        }
      ],
      "whatItDoes": "Turns cold-store provisions into plated service on a timetable.",
      "howItsBuilt": "Fin rows keep pastry, grill and cold separate while sharing one pass."
    },
    {
      "id": "laundry",
      "code": "LA",
      "name": "Laundry",
      "groupId": "crew",
      "floorId": "service-deck",
      "size": "s",
      "position": {
        "gx": 4,
        "gy": 15.405999999999999
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-la-1",
          "key": "capacity",
          "value": "3 tons / day"
        }
      ],
      "whatItDoes": "Keeps linens turning so cabins feel new each evening.",
      "howItsBuilt": "Laundry sits near crew quarters so hand-offs never cross guest flows."
    },
    {
      "id": "crew-quarters",
      "code": "CQ",
      "name": "Crew quarters",
      "groupId": "crew",
      "floorId": "service-deck",
      "size": "l",
      "position": {
        "gx": -4.5,
        "gy": 14.5
      },
      "faceTexture": "hatched",
      "archetypeOverride": "slab-stack",
      "properties": [
        {
          "id": "p-cq-1",
          "key": "berths",
          "value": "240"
        }
      ],
      "whatItDoes": "Houses the hands that keep hospitality and navigation separate.",
      "howItsBuilt": "A stacked form keeps crew life compact and rest protected."
    },
    {
      "id": "dining",
      "code": "DH",
      "name": "Dining hall",
      "groupId": "hospitality",
      "floorId": "main-deck",
      "size": "xl",
      "position": {
        "gx": -3.4899999999999998,
        "gy": 15.031999999999998
      },
      "faceTexture": "hatched",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-dh-1",
          "key": "seats",
          "value": "420"
        }
      ],
      "whatItDoes": "Hosts the evening meal that sets the rhythm of the ship.",
      "howItsBuilt": "A courtyard keeps service corridors hidden while keeping tables near the galley lift."
    },
    {
      "id": "lounge",
      "code": "LO",
      "name": "Lounge",
      "groupId": "hospitality",
      "floorId": "main-deck",
      "size": "m",
      "position": {
        "gx": -2.5,
        "gy": 27.5
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-lo-1",
          "key": "program",
          "value": "music nightly"
        }
      ],
      "whatItDoes": "Gathers guests after dinner for music and conversation.",
      "howItsBuilt": "Low mass and soft surfaces keep sound inside without sealing the horizon."
    },
    {
      "id": "pool",
      "code": "PT",
      "name": "Pool terrace",
      "groupId": "hospitality",
      "floorId": "main-deck",
      "size": "l",
      "position": {
        "gx": 9,
        "gy": 27.68
      },
      "faceTexture": "plain",
      "archetypeOverride": "low-slab",
      "properties": [
        {
          "id": "p-pt-1",
          "key": "pools",
          "value": "2 + splash"
        }
      ],
      "whatItDoes": "Holds day leisure where the horizon stays visible.",
      "howItsBuilt": "A low slab keeps wind low so the terrace remains usable in a swell."
    },
    {
      "id": "cabins",
      "code": "CB",
      "name": "Guest cabins",
      "groupId": "guests",
      "floorId": "main-deck",
      "size": "m",
      "position": {
        "gx": 9.23,
        "gy": 15.999999999999998
      },
      "faceTexture": "plain",
      "archetypeOverride": "podium-tower",
      "properties": [
        {
          "id": "p-cb-1",
          "key": "staterooms",
          "value": "180"
        }
      ],
      "whatItDoes": "Where guests rest between hospitality and horizon.",
      "howItsBuilt": "Podium-tower mirrors real ship massing so wayfinding feels intuitive."
    },
    {
      "id": "bridge",
      "code": "BR",
      "name": "Bridge",
      "groupId": "command",
      "floorId": "bridge-deck",
      "size": "l",
      "position": {
        "gx": -9,
        "gy": 23.46
      },
      "faceTexture": "hatched",
      "archetypeOverride": "bridge",
      "properties": [
        {
          "id": "p-br-1",
          "key": "watch",
          "value": "24h"
        }
      ],
      "whatItDoes": "Holds course, radar and the decision to change either.",
      "howItsBuilt": "A bridge form signals crossing: every control must be deliberate."
    },
    {
      "id": "lookout",
      "code": "LK",
      "name": "Lookout",
      "groupId": "command",
      "floorId": "bridge-deck",
      "size": "s",
      "position": {
        "gx": -2,
        "gy": 24
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-lk-1",
          "key": "optics",
          "value": "stabilized"
        }
      ],
      "whatItDoes": "Keeps a human eye on weather the radar smooths away.",
      "howItsBuilt": "Optics are isolated from vibration so a swell never blurs the horizon."
    },
    {
      "id": "spa",
      "code": "SP",
      "name": "Spa & calm",
      "groupId": "guests",
      "floorId": "bridge-deck",
      "size": "m",
      "position": {
        "gx": 6.5,
        "gy": 30
      },
      "faceTexture": "plain",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-sp-1",
          "key": "mood",
          "value": "quiet"
        }
      ],
      "whatItDoes": "Offers calm at height when the ship needs guests to feel steady.",
      "howItsBuilt": "A courtyard keeps calm acoustically separate from navigation."
    },
    {
      "id": "promenade",
      "code": "PR",
      "name": "Promenade",
      "groupId": "guests",
      "floorId": "bridge-deck",
      "size": "s",
      "position": {
        "gx": 7.1579999999999995,
        "gy": 24
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-pr-1",
          "key": "loop",
          "value": "full circuit"
        }
      ],
      "whatItDoes": "Lets guests walk the course they cannot steer.",
      "howItsBuilt": "A loop that stays open in all weathers so the horizon is always walkable."
    }
  ],
  "relations": [
    {
      "id": "r-fuel-engine",
      "from": "fuel",
      "to": "engine-room",
      "kind": "support",
      "label": "fuel feed"
    },
    {
      "id": "r-cold-galley",
      "from": "cold",
      "to": "galley",
      "kind": "flow",
      "label": "provisions"
    },
    {
      "id": "r-laundry-quarters",
      "from": "laundry",
      "to": "crew-quarters",
      "kind": "support",
      "label": "fresh linens"
    },
    {
      "id": "r-galley-dining",
      "from": "galley",
      "to": "dining",
      "kind": "flow",
      "label": "plated service"
    },
    {
      "id": "r-quarters-galley",
      "from": "crew-quarters",
      "to": "galley",
      "kind": "support",
      "label": "hands on deck"
    },
    {
      "id": "r-dining-lounge",
      "from": "dining",
      "to": "lounge",
      "kind": "flow",
      "label": "evening drift"
    },
    {
      "id": "r-lounge-pool",
      "from": "lounge",
      "to": "pool",
      "kind": "flow",
      "label": "day returns"
    },
    {
      "id": "r-cabins-dining",
      "from": "cabins",
      "to": "dining",
      "kind": "flow",
      "label": "guests to dinner"
    },
    {
      "id": "r-cabins-spa",
      "from": "cabins",
      "to": "spa",
      "kind": "flow",
      "label": "seek calm"
    },
    {
      "id": "r-bridge-engine",
      "from": "bridge",
      "to": "engine-room",
      "kind": "data",
      "label": "course orders"
    },
    {
      "id": "r-lookout-bridge",
      "from": "lookout",
      "to": "bridge",
      "kind": "data",
      "label": "visual report"
    },
    {
      "id": "r-spa-promenade",
      "from": "spa",
      "to": "promenade",
      "kind": "flow",
      "label": "steady feet"
    },
    {
      "id": "r-promenade-lookout",
      "from": "promenade",
      "to": "lookout",
      "kind": "support",
      "label": "horizon watch"
    },
    {
      "id": "r-pool-cabins",
      "from": "pool",
      "to": "cabins",
      "kind": "retry",
      "label": "return to cabin"
    }
  ],
  "flows": [
    {
      "id": "feed-ship",
      "name": "Feed the ship",
      "payload": "provisions",
      "summary": "From cold stores to a plated dinner.",
      "stages": [
        {
          "id": "feed-0",
          "traversals": [
            {
              "id": "feed-0-a",
              "relationId": "r-cold-galley",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "feed-1",
          "traversals": [
            {
              "id": "feed-1-a",
              "relationId": "r-galley-dining",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "feed-2",
          "traversals": [
            {
              "id": "feed-2-a",
              "relationId": "r-dining-lounge",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "evening-aboard",
      "name": "Evening aboard",
      "payload": "a guest evening",
      "summary": "A guest moves from cabin through dinner and music to calm.",
      "stages": [
        {
          "id": "evening-0",
          "traversals": [
            {
              "id": "evening-0-a",
              "relationId": "r-cabins-dining",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "evening-1",
          "traversals": [
            {
              "id": "evening-1-a",
              "relationId": "r-dining-lounge",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "evening-2",
          "traversals": [
            {
              "id": "evening-2-a",
              "relationId": "r-lounge-pool",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "evening-3",
          "traversals": [
            {
              "id": "evening-3-a",
              "relationId": "r-pool-cabins",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "hold-course",
      "name": "Hold the course",
      "payload": "navigation",
      "summary": "Keeps the bridge, engine and lookout aligned.",
      "stages": [
        {
          "id": "course-0",
          "traversals": [
            {
              "id": "course-0-a",
              "relationId": "r-lookout-bridge",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "course-1",
          "traversals": [
            {
              "id": "course-1-a",
              "relationId": "r-bridge-engine",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "course-2",
          "traversals": [
            {
              "id": "course-2-a",
              "relationId": "r-fuel-engine",
              "direction": "reverse"
            }
          ]
        }
      ]
    }
  ]
} as const;

export const NORTHWIND_COMMERCE = {
  "schemaVersion": 9,
  "id": "northwind-commerce",
  "name": "Northwind Commerce",
  "version": "v1.0",
  "description": "How a tap on a screen becomes a parcel on a doorstep.",
  "structureType": "tower",
  "createdAt": "2026-08-22T10:00:00.000Z",
  "updatedAt": "2026-08-23T03:00:46.110Z",
  "floors": [
    {
      "id": "storefront-floor",
      "name": "Storefront",
      "groupFlagPositions": {
        "shopper": {
          "gx": -5,
          "gy": 4
        }
      }
    },
    {
      "id": "services-floor",
      "name": "Services",
      "groupFlagPositions": {
        "checkout": {
          "gx": -6,
          "gy": 12.5
        },
        "trust": {
          "gx": 11.5,
          "gy": 12
        }
      }
    },
    {
      "id": "fulfillment-floor",
      "name": "Fulfillment",
      "groupFlagPositions": {
        "ops": {
          "gx": -6,
          "gy": 21.5
        },
        "carriers": {
          "gx": 19.5,
          "gy": 19.5
        }
      }
    }
  ],
  "groups": [
    {
      "id": "shopper",
      "name": "Storefront experience",
      "description": "Where customers browse and decide."
    },
    {
      "id": "checkout",
      "name": "Checkout core",
      "description": "Where intent becomes a paid order."
    },
    {
      "id": "trust",
      "name": "Risk & money",
      "description": "Where payment stays protected."
    },
    {
      "id": "ops",
      "name": "Warehouse operations",
      "description": "Where orders become parcels."
    },
    {
      "id": "carriers",
      "name": "Last mile",
      "description": "Where parcels leave for doorsteps."
    }
  ],
  "nodes": [
    {
      "id": "storefront",
      "code": "SF",
      "name": "Storefront app",
      "groupId": "shopper",
      "floorId": "storefront-floor",
      "size": "l",
      "position": {
        "gx": -7,
        "gy": -1
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-sf-1",
          "key": "platforms",
          "value": "web, mobile"
        }
      ],
      "whatItDoes": "Presents the catalog and captures what the shopper wants.",
      "howItsBuilt": "A thin front end; every decision can be replayed from cart and ledger events alone."
    },
    {
      "id": "catalog",
      "code": "CA",
      "name": "Search & catalog",
      "groupId": "shopper",
      "floorId": "storefront-floor",
      "size": "m",
      "position": {
        "gx": -0.5,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-ca-1",
          "key": "index refresh",
          "value": "every 5 minutes"
        }
      ],
      "whatItDoes": "Answers search queries with ranked, in-stock products.",
      "howItsBuilt": "Reads from a replicated index so browsing never waits on writes."
    },
    {
      "id": "cart",
      "code": "CT",
      "name": "Cart",
      "groupId": "shopper",
      "floorId": "storefront-floor",
      "size": "s",
      "position": {
        "gx": 5,
        "gy": 0
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-ct-1",
          "key": "expiry",
          "value": "30 days idle"
        }
      ],
      "whatItDoes": "Holds the shopper's intent between visits and across devices.",
      "howItsBuilt": "Cart state is keyed to the shopper so checkout always receives one coherent basket."
    },
    {
      "id": "checkout-api",
      "code": "CK",
      "name": "Checkout API",
      "groupId": "checkout",
      "floorId": "services-floor",
      "size": "m",
      "position": {
        "gx": -7,
        "gy": 8
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-ck-1",
          "key": "purchase timeout",
          "value": "12 seconds"
        }
      ],
      "whatItDoes": "Turns a submitted cart into a single atomic purchase attempt.",
      "howItsBuilt": "Orchestrates pricing, fraud, payment and reservation as one saga that either fully lands or fully rolls back."
    },
    {
      "id": "pricing",
      "code": "PR",
      "name": "Pricing engine",
      "groupId": "checkout",
      "floorId": "services-floor",
      "size": "s",
      "position": {
        "gx": -1.5,
        "gy": 9
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-pr-1",
          "key": "ruleset",
          "value": "pinned per order"
        }
      ],
      "whatItDoes": "Computes the total the shopper agreed to before anything is charged.",
      "howItsBuilt": "Rules are versioned, so any past total can be reproduced exactly during a dispute."
    },
    {
      "id": "ledger",
      "code": "LG",
      "name": "Order ledger",
      "groupId": "checkout",
      "floorId": "services-floor",
      "size": "l",
      "position": {
        "gx": 3,
        "gy": 8
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-lg-1",
          "key": "retention",
          "value": "10 years"
        }
      ],
      "whatItDoes": "Keeps one append-only record of everything that was bought.",
      "howItsBuilt": "Orders are never edited; corrections arrive as new entries that reference what they fix."
    },
    {
      "id": "fraud",
      "code": "FR",
      "name": "Fraud screening",
      "groupId": "trust",
      "floorId": "services-floor",
      "size": "m",
      "position": {
        "gx": 9.5,
        "gy": 7.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "stepped-pyramid",
      "properties": [
        {
          "id": "p-fr-1",
          "key": "signals",
          "value": "device, velocity, history"
        }
      ],
      "whatItDoes": "Weighs each charge against risk signals before money moves.",
      "howItsBuilt": "Checks run in layers; each layer can only tighten a decision, never loosen it."
    },
    {
      "id": "gateway",
      "code": "GW",
      "name": "Payment gateway",
      "groupId": "trust",
      "floorId": "services-floor",
      "size": "l",
      "position": {
        "gx": 15.5,
        "gy": 8
      },
      "faceTexture": "hatched",
      "archetypeOverride": "bridge",
      "properties": [
        {
          "id": "p-gw-1",
          "key": "retries",
          "value": "3, exponential backoff"
        }
      ],
      "whatItDoes": "Carries charges out to card networks and brings authorizations back.",
      "howItsBuilt": "A deliberate crossing point: transient declines are retried on separate rails until one settles or all fail."
    },
    {
      "id": "inventory",
      "code": "NV",
      "name": "Inventory ledger",
      "groupId": "ops",
      "floorId": "fulfillment-floor",
      "size": "xl",
      "position": {
        "gx": -7.5,
        "gy": 15.5
      },
      "faceTexture": "hatched",
      "properties": [
        {
          "id": "p-nv-1",
          "key": "cycle count",
          "value": "nightly"
        }
      ],
      "whatItDoes": "Tracks every unit the company has promised to sell.",
      "howItsBuilt": "Reservations expire automatically, so a stuck order can never quietly hide stock from everyone else."
    },
    {
      "id": "picking",
      "code": "PK",
      "name": "Picking line",
      "groupId": "ops",
      "floorId": "fulfillment-floor",
      "size": "m",
      "position": {
        "gx": 0.5,
        "gy": 16.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "fin-row",
      "properties": [
        {
          "id": "p-pk-1",
          "key": "wave size",
          "value": "40 orders"
        },
        {
          "id": "p-pk-2",
          "key": "aisles",
          "value": "12"
        },
        {
          "id": "p-pk-3",
          "key": "shifts",
          "value": "day + evening"
        }
      ],
      "whatItDoes": "Walks the warehouse once per wave and gathers everything an order needs.",
      "howItsBuilt": "Pick paths are batched by aisle to keep walking distance, and therefore payroll, low."
    },
    {
      "id": "packing",
      "code": "PA",
      "name": "Packing benches",
      "groupId": "ops",
      "floorId": "fulfillment-floor",
      "size": "m",
      "position": {
        "gx": 7,
        "gy": 16.5
      },
      "faceTexture": "plain",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-pa-1",
          "key": "weight mismatch",
          "value": "auto hold"
        }
      ],
      "whatItDoes": "Turns picked items into sealed, labelled parcels.",
      "howItsBuilt": "Each parcel is weighed against its manifest before a label will print; surprises stop here."
    },
    {
      "id": "dock",
      "code": "DK",
      "name": "Dispatch dock",
      "groupId": "ops",
      "floorId": "fulfillment-floor",
      "size": "xl",
      "position": {
        "gx": 13,
        "gy": 15.5
      },
      "faceTexture": "hatched",
      "archetypeOverride": "courtyard",
      "properties": [
        {
          "id": "p-dk-1",
          "key": "carrier pickups",
          "value": "4 per day"
        }
      ],
      "whatItDoes": "Sorts sealed parcels into the right carrier pickup.",
      "howItsBuilt": "A parcel scans out only after its carrier manifest closes, so nothing leaves unaccounted."
    },
    {
      "id": "courier",
      "code": "CW",
      "name": "Courier fleet",
      "groupId": "carriers",
      "floorId": "fulfillment-floor",
      "size": "s",
      "position": {
        "gx": 20,
        "gy": 17
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-cw-1",
          "key": "partners",
          "value": "integrated by scan events only"
        }
      ],
      "whatItDoes": "Carries parcels from the dock to the doorstep.",
      "howItsBuilt": "External partners are integrated through scan events, never through shared internals."
    },
    {
      "id": "doorstep",
      "code": "DS",
      "name": "Doorstep",
      "groupId": "carriers",
      "floorId": "fulfillment-floor",
      "size": "xs",
      "position": {
        "gx": 24.5,
        "gy": 17.5
      },
      "faceTexture": "plain",
      "properties": [
        {
          "id": "p-ds-1",
          "key": "safe place",
          "value": "photo confirmed"
        }
      ],
      "whatItDoes": "The moment the promise ends and the parcel changes hands.",
      "howItsBuilt": "Modelled as its own concept because deliveries fail here most often and retries must be visible."
    }
  ],
  "relations": [
    {
      "id": "r-catalog-data",
      "from": "catalog",
      "to": "storefront",
      "kind": "support",
      "label": "product data"
    },
    {
      "id": "r-cart-add",
      "from": "storefront",
      "to": "cart",
      "kind": "flow",
      "label": "add to cart"
    },
    {
      "id": "r-cart-submit",
      "from": "cart",
      "to": "checkout-api",
      "kind": "flow",
      "label": "submitted cart"
    },
    {
      "id": "r-pricing-quote",
      "from": "pricing",
      "to": "checkout-api",
      "kind": "support",
      "label": "price quotes"
    },
    {
      "id": "r-checkout-fraud",
      "from": "checkout-api",
      "to": "fraud",
      "kind": "flow",
      "label": "charge for screening"
    },
    {
      "id": "r-fraud-gateway",
      "from": "fraud",
      "to": "gateway",
      "kind": "flow",
      "label": "cleared charge"
    },
    {
      "id": "r-gateway-ledger",
      "from": "gateway",
      "to": "ledger",
      "kind": "data",
      "label": "settlement record"
    },
    {
      "id": "r-ledger-inventory",
      "from": "ledger",
      "to": "inventory",
      "kind": "flow",
      "label": "order to pick"
    },
    {
      "id": "r-inventory-picker",
      "from": "inventory",
      "to": "picking",
      "kind": "flow",
      "label": "pick list"
    },
    {
      "id": "r-picker-packer",
      "from": "picking",
      "to": "packing",
      "kind": "flow",
      "label": "picked items"
    },
    {
      "id": "r-packer-dock",
      "from": "packing",
      "to": "dock",
      "kind": "flow",
      "label": "sealed parcels"
    },
    {
      "id": "r-dock-courier",
      "from": "dock",
      "to": "courier",
      "kind": "flow",
      "label": "parcel handoff"
    },
    {
      "id": "r-doorstep-attempt",
      "from": "courier",
      "to": "doorstep",
      "kind": "retry",
      "label": "delivery attempts"
    },
    {
      "id": "r-tracking-updates",
      "from": "courier",
      "to": "storefront",
      "kind": "data",
      "label": "tracking updates"
    }
  ],
  "flows": [
    {
      "id": "place-order",
      "name": "Place an order",
      "payload": "a paid order",
      "summary": "Follows a submitted cart all the way to a doorstep delivery.",
      "stages": [
        {
          "id": "place-order-0",
          "traversals": [
            {
              "id": "place-order-0-a",
              "relationId": "r-cart-submit",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-1",
          "traversals": [
            {
              "id": "place-order-1-a",
              "relationId": "r-checkout-fraud",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-2",
          "traversals": [
            {
              "id": "place-order-2-a",
              "relationId": "r-fraud-gateway",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-3",
          "traversals": [
            {
              "id": "place-order-3-a",
              "relationId": "r-gateway-ledger",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-4",
          "traversals": [
            {
              "id": "place-order-4-a",
              "relationId": "r-ledger-inventory",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-5",
          "traversals": [
            {
              "id": "place-order-5-a",
              "relationId": "r-inventory-picker",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-6",
          "traversals": [
            {
              "id": "place-order-6-a",
              "relationId": "r-picker-packer",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-7",
          "traversals": [
            {
              "id": "place-order-7-a",
              "relationId": "r-packer-dock",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-8",
          "traversals": [
            {
              "id": "place-order-8-a",
              "relationId": "r-dock-courier",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "place-order-9",
          "traversals": [
            {
              "id": "place-order-9-a",
              "relationId": "r-doorstep-attempt",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "browse-and-fill",
      "name": "Browse and fill the cart",
      "payload": "shopping intent",
      "summary": "Shows how catalog data supports every choice a shopper makes.",
      "stages": [
        {
          "id": "browse-and-fill-0",
          "traversals": [
            {
              "id": "browse-and-fill-0-a",
              "relationId": "r-catalog-data",
              "direction": "forward"
            }
          ]
        },
        {
          "id": "browse-and-fill-1",
          "traversals": [
            {
              "id": "browse-and-fill-1-a",
              "relationId": "r-cart-add",
              "direction": "forward"
            }
          ]
        }
      ]
    },
    {
      "id": "refund-request",
      "name": "Refund a charge",
      "payload": "a refund",
      "summary": "Retraces the payment path backwards when money must go home.",
      "stages": [
        {
          "id": "refund-request-0",
          "traversals": [
            {
              "id": "refund-request-0-a",
              "relationId": "r-gateway-ledger",
              "direction": "reverse"
            }
          ]
        },
        {
          "id": "refund-request-1",
          "traversals": [
            {
              "id": "refund-request-1-a",
              "relationId": "r-fraud-gateway",
              "direction": "reverse"
            }
          ]
        },
        {
          "id": "refund-request-2",
          "traversals": [
            {
              "id": "refund-request-2-a",
              "relationId": "r-checkout-fraud",
              "direction": "reverse"
            }
          ]
        }
      ]
    }
  ]
} as const;

export const EXAMPLE_MAPS: readonly OntologyDocument[] = [ATLAS_TOWER, HARBOR_CAMPUS, AURORA_LINER, NORTHWIND_COMMERCE] as unknown as readonly OntologyDocument[]
