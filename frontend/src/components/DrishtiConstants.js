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