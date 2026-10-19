/** Live report box labels only; statutory IDs and wire/export labels stay intact. */
export function vatBoxLabelKey(box: string) {
  switch (box) {
    case "1": return "boxOne";
    case "2": return "boxTwo";
    case "3": return "boxThree";
    case "4": return "boxFour";
    case "5": return "boxFive";
    case "6": return "boxSix";
    case "7": return "boxSeven";
    case "8": return "boxEight";
    case "9": return "boxNine";
    default: return null;
  }
}
