import fs from "fs";

const html = `
<!DOCTYPE html>
<html>
<body style="background: #111; margin: 0; padding: 20px; color: white;">
  <h2>Crop 1: Aging Summary (Receivables & Payables)</h2>
  <div style="width: 700px; height: 350px; overflow: hidden; border: 2px solid yellow; position: relative;">
    <img src="file:///C:/Users/Sajjad/AppData/Roaming/Code - Insiders/agentSessionData/c4372c8f-0545-4994-9564-49bcba444dcb/attachments/643f9f83-5653-46d5-9567-af361c134175/Pasted Image.png" 
         style="position: absolute; left: -50px; top: -10px; width: 1416px; height: 768px;">
  </div>
  <h2>Crop 2: Revenue vs Expenses</h2>
  <div style="width: 700px; height: 350px; overflow: hidden; border: 2px solid cyan; position: relative;">
    <img src="file:///C:/Users/Sajjad/AppData/Roaming/Code - Insiders/agentSessionData/c4372c8f-0545-4994-9564-49bcba444dcb/attachments/643f9f83-5653-46d5-9567-af361c134175/Pasted Image.png" 
         style="position: absolute; left: -680px; top: -10px; width: 1416px; height: 768px;">
  </div>
  <h2>Crop 3: Cash Flow Chart Y-axis</h2>
  <div style="width: 700px; height: 350px; overflow: hidden; border: 2px solid magenta; position: relative;">
    <img src="file:///C:/Users/Sajjad/AppData/Roaming/Code - Insiders/agentSessionData/c4372c8f-0545-4994-9564-49bcba444dcb/attachments/643f9f83-5653-46d5-9567-af361c134175/Pasted Image.png" 
         style="position: absolute; left: -80px; top: -400px; width: 1416px; height: 768px;">
  </div>
  <h2>Crop 4: Bottom of Cash Flow (Summary)</h2>
  <div style="width: 1300px; height: 200px; overflow: hidden; border: 2px solid green; position: relative;">
    <img src="file:///C:/Users/Sajjad/AppData/Roaming/Code - Insiders/agentSessionData/c4372c8f-0545-4994-9564-49bcba444dcb/attachments/643f9f83-5653-46d5-9567-af361c134175/Pasted Image.png" 
         style="position: absolute; left: -80px; top: -600px; width: 1416px; height: 768px;">
  </div>
</body>
</html>
`;
fs.writeFileSync("scripts/inspect-crop.html", html);
