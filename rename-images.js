const fs = require('fs');
const path = require('path');

// Categories to process
const categories = ["BASE", "BACKGROUND", "EYES", "MOUTH", "HEAD", "CLOTHING", "ACCESSORIES"];

// Mapping of descriptive names to numeric IDs
const nameToId = {
  // BASE
  "basic.png": "0.png",
  "athletic.png": "1.png",
  "average.png": "2.png",
  "lean.png": "3.png",
  "muscular.png": "4.png",
  "chubby.png": "5.png",
  "tall.png": "6.png",
  "cybernetic.png": "7.png",
  "mutant.png": "8.png",
  "perfect.png": "9.png",
  "alien.png": "10.png",
  "body_0.png": "0.png",
  "body_1.png": "1.png",
  "body_2.png": "2.png",
  "body_3.png": "3.png",
  "body_4.png": "4.png",
  "body_5.png": "5.png",
  "body_6.png": "6.png",
  "body_7.png": "7.png",
  "body_8.png": "8.png",
  "body_9.png": "9.png",
  "body_10.png": "10.png",
  "normal.png": "0.png",
  "rare.png": "1.png",
  
  // BACKGROUND
  "blue.png": "1.png",
  "green.png": "2.png",
  "red.png": "3.png",
  
  // MOUTH
  "smile.png": "1.png",
  "serious.png": "2.png",
  "surprised.png": "3.png",
  
  // EYES
  "normal.png": "1.png",
  "cool.png": "2.png",
  "laser.png": "3.png",
  
  // HEAD
  "hat.png": "1.png",
  "cap.png": "2.png",
  
  // CLOTHING
  "lab_coat.png": "1.png",
  "suit.png": "2.png",
  "casual.png": "3.png",
  
  // ACCESSORIES
  "glasses.png": "1.png",
  "watch.png": "2.png",
  "none.png": "0.png"
};

// Process each category
for (const category of categories) {
  const dirPath = path.join(process.cwd(), 'public', 'traits', category);
  console.log(`Processing ${category} directory...`);
  
  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dirPath} not found, skipping.`);
    continue;
  }
  
  // Get files in directory
  const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.png'));
  
  // Rename files
  for (const file of files) {
    if (nameToId[file]) {
      const oldPath = path.join(dirPath, file);
      const newPath = path.join(dirPath, nameToId[file]);
      
      // Skip if destination already exists
      if (fs.existsSync(newPath)) {
        console.log(`${newPath} already exists, skipping ${file}`);
        continue;
      }
      
      // Create a copy instead of renaming to avoid losing the original files
      fs.copyFileSync(oldPath, newPath);
      console.log(`Copied ${file} to ${nameToId[file]}`);
    } else {
      console.log(`No mapping found for ${file}, skipping.`);
    }
  }
}

console.log('Image renaming complete!'); 