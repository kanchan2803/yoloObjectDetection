export const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
  "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

export const PRIORITY_MAP = {
  "person": 100,
  "car": 95, "bus": 95, "truck": 95, "motorcycle": 95,
  "stop sign": 90, "traffic light": 90,
  "fire hydrant": 80, "dog": 75, "cat": 70,
  "cell phone": 65, "knife": 60,
  "default": 10
};

export const MODES = {
  NORMAL: {
    id: "NORMAL",
    label: "Normal Mode",
    description: "Full environmental awareness.",
    activeClasses: COCO_CLASSES, // 100% of classes
    cooldown: 2500,
    minConfidence: 0.22 
  },

  HOME: {
    id: "HOME",
    label: "Home Mode",
    // All indoor items + Pets + People
    activeClasses: [
      "person", "cat", "dog", "backpack", "umbrella", "handbag", "tie", "suitcase",
      "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", 
      "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", 
      "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", 
      "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
    ],
    cooldown: 2500,
    minConfidence: 0.25
  },

  OUTDOOR: {
    id: "OUTDOOR",
    label: "Outdoor Mode",
    // Transport, Animals, Street Furniture, and Safety Hazards
    activeClasses: [
      "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
      "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
      "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", 
      "umbrella", "handbag", "suitcase", "frisbee", "skis", "snowboard", "sports ball", 
      "kite", "skateboard", "surfboard"
    ],
    cooldown: 1800,
    minConfidence: 0.30
  },

  SHOPPING: {
    id: "SHOPPING",
    label: "Shopping Mode",
    // Everything purchasable or used in a store/restaurant context
    activeClasses: [
      "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", 
      "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
      "backpack", "handbag", "tie", "suitcase", "cell phone", "book", "vase", "teddy bear", "toothbrush"
    ],
    cooldown: 2000,
    minConfidence: 0.25
  },

  SOCIAL: {
    id: "SOCIAL",
    label: "Social Mode",
    // Focus on people, their accessories, and social settings
    activeClasses: [
      "person", "dog", "cat", "backpack", "umbrella", "handbag", "tie", "suitcase", 
      "cell phone", "wine glass", "cup", "cake", "pizza", "sandwich", "chair", "couch"
    ],
    cooldown: 3000,
    minConfidence: 0.35
  },

  PATHFINDER: {
    id: "PATHFINDER",
    label: "Pathfinder",
    // Strict focus on physical obstacles only
    activeClasses: [
      "person", "bicycle", "car", "motorcycle", "bus", "train", "truck", "bench", 
      "dog", "horse", "sheep", "cow", "chair", "couch", "bed", "dining table", "toilet"
    ],
    isStrictSafety: true,
    cooldown: 1500,
    minConfidence: 0.35
  },

  EMERGENCY: {
    id: "EMERGENCY",
    label: "Emergency Mode",
    activeClasses: COCO_CLASSES,
    cooldown: 500,
    prefix: "DANGER!",
    minConfidence: 0.15 // Catch movement in low visibility
  },

  SILENT: {
    id: "SILENT",
    label: "Silent",
    activeClasses: COCO_CLASSES,
    isMuted: true,
    minConfidence: 0.25
  }
};

// export const COCO_CLASSES = [
//   "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
//   "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
//   "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
//   "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
//   "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
//   "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
//   "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
//   "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
//   "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
//   "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
// ];

// // PASTE THIS PART SPECIFICALLY:
// export const PRIORITY_MAP = {
//   "person": 100,
//   "car": 90, "bus": 90, "truck": 90, "motorcycle": 95,
//   "traffic light": 85, "stop sign": 85,
//   "dog": 70, "cat": 70,
//   "cell phone": 60,
//   "default": 10
// };

// export const MODES = {
//   NORMAL: {
//     id: "NORMAL",
//     label: "Normal Mode",
//     activeClasses: COCO_CLASSES, // Full 80 classes
//     cooldown: 2500,
//     minConfidence: 0.25 
//   },
//   HOME: {
//     id: "HOME",
//     label: "Home Mode",
//     // Comprehensive indoor list: Furniture, Appliances, Kitchenware, and Safety
//     activeClasses: [
//       "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", 
//       "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", 
//       "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", 
//       "toothbrush", "person", "dog", "cat", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl"
//     ],
//     cooldown: 3000,
//     minConfidence: 0.25
//   },
//   OUTDOOR: {
//     id: "OUTDOOR",
//     label: "Outdoor Mode",
//     // Mobility, Traffic, Animals, and Street Furniture
//     activeClasses: [
//       "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
//       "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
//       "dog", "horse", "sheep", "cow", "elephant", "zebra", "giraffe", "backpack", "umbrella", "handbag"
//     ],
//     cooldown: 2000,
//     minConfidence: 0.28 // Slightly higher to avoid sun-glare artifacts
//   },
//   SHOPPING: {
//     id: "SHOPPING",
//     label: "Shopping Mode",
//     // Focus: Food items, Carry-bags, and Tableware
//     activeClasses: [
//       "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
//       "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
//       "handbag", "suitcase", "backpack", "cell phone", "keyboard", "book"
//     ],
//     cooldown: 2000,
//     minConfidence: 0.25
//   },
//   COUNT: {
//     id: "COUNT",
//     label: "Count Mode",
//     activeClasses: COCO_CLASSES,
//     isCount: true,
//     cooldown: 5000,
//     minConfidence: 0.30 // Higher confidence so we don't double-count "ghosts"
//   },
//   EMERGENCY: {
//     id: "EMERGENCY",
//     label: "Emergency Mode",
//     activeClasses: COCO_CLASSES,
//     cooldown: 800,
//     prefix: "Urgent!",
//     minConfidence: 0.15 
//   },
//   SOCIAL: {
//     id: "SOCIAL",
//     label: "Social Mode",
//     activeClasses: ["person", "dog", "cat", "cell phone", "handbag", "backpack", "tie", "suitcase", "clock"],
//     cooldown: 3500,
//     minConfidence: 0.30
//   },
//   PATHFINDER: {
//     id: "PATHFINDER",
//     label: "Pathfinder",
//     activeClasses: ["person", "bicycle", "car", "motorcycle", "bus", "truck", "bench", "dog", "chair", "couch", "dining table"],
//     isStrictSafety: true,
//     cooldown: 2000,
//     minConfidence: 0.35
//   },
//   SILENT: {
//     id: "SILENT",
//     label: "Silent",
//     activeClasses: COCO_CLASSES,
//     isMuted: true,
//     minConfidence: 0.25
//   }
// };

// export const COCO_CLASSES = [
//   "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
//   "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
//   "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
//   "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
//   "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
//   "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
//   "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
//   "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
//   "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
//   "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
// ];

// export const PRIORITY_MAP = {
//   "person": 100,
//   "car": 90, "bus": 90, "truck": 90, "motorcycle": 95,
//   "traffic light": 85, "stop sign": 85,
//   "dog": 70, "cat": 70,
//   "cell phone": 60,
//   "default": 10
// };

// export const MODES = {
//   NORMAL: {
//     id: "NORMAL",
//     label: "Normal Mode",
//     description: "Maximum environmental awareness.",
//     activeClasses: COCO_CLASSES, // Detects everything
//     cooldown: 2500,
//     minConfidence: 0.25 // Highly sensitive
//   },
//   HOME: {
//     id: "HOME",
//     label: "Home Mode",
//     description: "Indoor focus with safety override.",
//     // Added 'person' and 'dog' to Home mode for safety
//     activeClasses: ["chair", "couch", "bed", "dining table", "toilet", "tv", "laptop", "refrigerator", "book", "clock", "person", "dog", "cat", "bottle", "cup"],
//     cooldown: 3000,
//     minConfidence: 0.25
//   },
//   OUTDOOR: {
//     id: "OUTDOOR",
//     label: "Outdoor Mode",
//     description: "Priority on mobility and hazards.",
//     activeClasses: ["person", "car", "bus", "truck", "traffic light", "stop sign", "bicycle", "motorcycle", "dog", "bench", "backpack", "umbrella"],
//     cooldown: 2000,
//     minConfidence: 0.25
//   },
//   SHOPPING: {
//     id: "SHOPPING",
//     label: "Shopping Mode",
//     description: "Detecting items and handheld objects.",
//     activeClasses: ["bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "handbag", "cell phone", "backpack"],
//     cooldown: 2500,
//     minConfidence: 0.25
//   },
//   EMERGENCY: {
//     id: "EMERGENCY",
//     label: "Emergency Mode",
//     description: "Fastest possible alerts.",
//     activeClasses: COCO_CLASSES,
//     cooldown: 1000,
//     prefix: "Urgent!",
//     minConfidence: 0.20 // Maximum sensitivity to catch anything moving
//   },
//   SOCIAL: {
//     id: "SOCIAL",
//     label: "Social Mode",
//     description: "Focus on people and personal items.",
//     activeClasses: ["person", "cell phone", "handbag", "backpack", "tie"],
//     cooldown: 3000,
//     minConfidence: 0.30 // Slightly higher to avoid ghost-people in background
//   },
//   COUNT: {
//     id: "COUNT",
//     label: "Count Mode",
//     description: "Tallying all objects in view.",
//     activeClasses: COCO_CLASSES,
//     cooldown: 5000,
//     isCount: true,
//     minConfidence: 0.25
//   },
//   READING: {
//     id: "READING",
//     label: "Reading Mode",
//     description: "OCR focus.",
//     activeClasses: [],
//     isOCR: true,
//     cooldown: 0
//   },
//   NIGHT: {
//     id: "NIGHT",
//     label: "Night Mode",
//     description: "Extreme sensitivity for low light.",
//     activeClasses: COCO_CLASSES,
//     cooldown: 2500,
//     minConfidence: 0.18 // Lowest threshold for grainy camera feeds
//   },
//   SILENT: {
//     id: "SILENT",
//     label: "Silent Mode",
//     description: "Visual-only feedback.",
//     activeClasses: COCO_CLASSES,
//     isMuted: true,
//     minConfidence: 0.25
//   },
  
//   PATHFINDER: {
//     label: "Pathfinder",
//     prefix: "Path update:",
//     minConfidence: 0.35,
//     activeClasses: ["person", "chair", "table", "door", "stair", "vehicle"], // Focus only on obstacles
//     cooldown: 2000,
//     isStrictSafety: true // Custom flag for our new logic
//   },

//   CONVERSATION: {
//     label: "AI Assistant",
//     prefix: "Assistant:",
//     activeClasses: [], // Sees everything
//     isInteractive: true, // Flag for the LLM integration later
//     cooldown: 5000
//   },
// };