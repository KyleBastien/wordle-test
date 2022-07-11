import babar from "babar";
import fastMemoize from "fast-memoize";
import { allNonSolutionWords } from "./all-words";
import { solutionWords } from "./solution-words";

const fullList = [...solutionWords, ...allNonSolutionWords];

interface Filter {
  color: "black" | "green" | "yellow";
  position: number;
  letter: string;
  group: string;
}

const matchesFilters = (wordList: string[], filters: Filter[]) => {
  return wordList.filter((word) => {
    let match = true;
    for (let i = 0; i < filters.length; i += 1) {
      const { color, position, letter, group } = filters[i];

      const filterGroupIndex =
        filters
          .filter((filter) => {
            return filter.group === group && letter === filter.letter;
          })
          .indexOf(filters[i]) + 1;

      if (color === "black") {
        if (filterGroupIndex > 1) {
          if (word.split(letter).length - 1 > filterGroupIndex) {
            match = false;
            break;
          }
        } else if (word.includes(letter)) {
          match = false;
          break;
        }
      }

      if (color === "green") {
        if (word[position] !== letter) {
          match = false;
          break;
        }
      }

      if (color === "yellow") {
        if (!word.includes(letter) || word[position] === letter) {
          match = false;
          break;
        }
      }
    }
    return match;
  });
};

const colors = ["green", "yellow", "black"] as const;

interface LetterColor {
  p: number;
  list: string[];
}

const calculateLetterColor = (
  wordList: string[],
  letter: string,
  position: number,
  color: "black" | "green" | "yellow"
): LetterColor => {
  const matchingWords = matchesFilters(wordList, [
    { color, position, letter, group: "future" },
  ]);
  return {
    p: (matchingWords.length * 1.0) / wordList.length,
    list: matchingWords,
  };
};

type Tree = {
  black?: LetterColor | Tree;
  green?: LetterColor | Tree;
  yellow?: LetterColor | Tree;
  list: string[];
  p: number;
};

const createTreeForWord = (
  word: string,
  tree: Tree,
  depth: number
): Tree | void => {
  // Recursively create decision tree structure
  if (depth > 4) {
    return tree;
  } else {
    // For each color, add probabilities and new lists
    colors.forEach((color) => {
      if (!tree[color] && tree.list.length > 0) {
        tree[color] = calculateLetterColor(
          tree.list,
          word[depth],
          depth,
          color
        );
      }
    });
    const newDepth = depth + 1;
    colors.forEach((color) => {
      if (tree.list.length > 0) {
        createTreeForWord(word, tree[color] as Tree, newDepth);
      }
    });
  }
};

const fillInTreeForWord = (word: string, originalList: string[]) => {
  let depth = 0;
  let composedTree: Tree = { list: originalList, p: 1 };
  createTreeForWord(word, composedTree, depth);
  return composedTree;
};

const calculatePForTree = (
  pValues: number[],
  tree: Tree,
  p: number,
  depth: number
) => {
  colors.forEach((color) => {
    if (tree[color] && (tree[color]?.list.length ?? 0) > 0) {
      if (depth === 4) {
        pValues.push((tree[color]?.p ?? 0) * p);
      } else {
        calculatePForTree(
          pValues,
          tree[color] as Tree,
          (tree[color]?.p ?? 0) * p,
          depth + 1
        );
      }
    }
  });
};

const calculateWordScore = (tree: Tree) => {
  // Go through each branch in tree to multiply probabilities
  // Square each probability and add to array
  // Return the sum of the array
  const pValues: number[] = [];
  const depth = 0;
  calculatePForTree(pValues, tree, 1, depth);
  const pSquared = pValues.map((value) => value * value);
  const score = pSquared.reduce((pv, cv) => pv + cv, 0);
  return score;
};

interface Guess {
  minScore: number;
  word: string;
  list: string[];
}

const calculate = fastMemoize(
  (filters: Filter[], mode: "hard" | "easy"): Guess => {
    const filteredList = matchesFilters(fullList, [...filters]);

    let usedList = mode === "hard" ? filteredList : fullList;

    let minScore = 1;
    let minWord = usedList[0];

    if (filteredList.length === 1) {
      return { minScore, word: filteredList[0], list: filteredList };
    } else {
      if (filteredList.length < 3) {
        // Start guessing potential words to see if you get lucky
        usedList = filteredList;
      }
      for (let i = 1; i < usedList.length; i += 1) {
        const oneWordTree = fillInTreeForWord(usedList[i], filteredList);
        const score = calculateWordScore(oneWordTree);
        if (score < minScore) {
          minScore = score;
          minWord = usedList[i];
        }
      }
      return { minScore, word: minWord, list: filteredList };
    }
  }
);

function replaceAt(word: string, index: number, replaceWith: string = "-") {
  return word.substring(0, index) + replaceWith + word.substring(index + 1);
}

function isThisTheWord(
  input: string,
  goalWord: string,
  guessNumber: number
): Filter[] {
  const result: Filter[] = new Array(input.length);

  let inputWordCopy = input.slice();

  // count the number of times each letter appears in goalWord
  const letterMap = new Map<string, number>();
  for (let i = 0; i < goalWord.length; i += 1) {
    const letter = goalWord[i];
    if (letterMap.has(letter)) {
      letterMap.set(letter, (letterMap.get(letter) ?? 0) + 1);
    } else {
      letterMap.set(letter, 1);
    }
  }

  // green pass
  for (let i = 0; i < input.length; i++) {
    const letter = input[i];
    if (goalWord[i] === letter) {
      result[i] = {
        position: i,
        letter,
        color: "green",
        group: guessNumber.toString(),
      };
      inputWordCopy = replaceAt(inputWordCopy, i);
    }
  }

  // yellow pass
  let timeWeSetLetterToYellow = new Map<string, number>();
  for (let i = 0; i < input.length; i++) {
    const letter = input[i];
    if (inputWordCopy[i] !== "-" && goalWord.includes(letter)) {
      if (
        (timeWeSetLetterToYellow.get(letter) ?? 0) <
        (letterMap.get(letter) ?? 0)
      ) {
        result[i] = {
          color: "yellow",
          position: i,
          letter,
          group: guessNumber.toString(),
        };
        timeWeSetLetterToYellow.set(
          letter,
          (timeWeSetLetterToYellow.get(letter) ?? 0) + 1
        );
        inputWordCopy = replaceAt(inputWordCopy, i);
      }
    }
  }

  for (let i = 0; i < input.length; i++) {
    const letter = input[i];
    if (inputWordCopy[i] !== "-") {
      result[i] = {
        color: "black",
        letter,
        position: i,
        group: guessNumber.toString(),
      };
      inputWordCopy = replaceAt(inputWordCopy, i);
    }
  }

  return result;
}

// play the game
const playGame = (word?: string) => {
  const startTime = performance.now();
  const attemptCountList: number[] = [];
  if (!word) {
    for (let wordIndex = 0; wordIndex < solutionWords.length; wordIndex++) {
      const goalWord = solutionWords[wordIndex];
      let guess = "";
      let pastGuesses: string[] = [];
      const guessResult: Filter[] = [];
      let numberOfGuesses = 0;
      while (guess !== goalWord && numberOfGuesses < 7) {
        const result = calculate(guessResult, "easy");

        guess = result.word;
        pastGuesses.push(guess.slice(0));
        numberOfGuesses++;
        guessResult.push(
          ...isThisTheWord(result.word, goalWord, numberOfGuesses)
        );
      }
      console.log(`Completed game ${wordIndex}`);
      console.log("Guesses were: ", pastGuesses);
      if (pastGuesses.length > 6) {
        console.log("Didn't get goal word in 6 guesses", goalWord);
        console.log("Guesses were: ", pastGuesses);
        console.log(
          "Guess Results were: ",
          guessResult.sort((a, b) => Number(a.group) - Number(b.group))
        );
        throw new Error("Didn't get goal word in 6 guesses");
      }
      attemptCountList.push(pastGuesses.length);
      console.log("\n");
    }
  } else {
    const goalWord = word;
    let guess = "";
    let pastGuesses: string[] = [];
    const guessResult: Filter[] = [];
    let numberOfGuesses = 0;
    while (guess !== goalWord && numberOfGuesses < 7) {
      const result = calculate(guessResult, "easy");

      guess = result.word;
      pastGuesses.push(guess.slice(0));
      numberOfGuesses++;
      guessResult.push(
        ...isThisTheWord(result.word, goalWord, numberOfGuesses)
      );
    }
    console.log(`Completed game for ${word}`);
    console.log("Guesses were: ", pastGuesses);
    if (pastGuesses.length > 6) {
      console.log("Didn't get goal word in 6 guesses", goalWord);
      console.log("Guesses were: ", pastGuesses);
      console.log(
        "Guess Results were: ",
        guessResult.sort((a, b) => Number(a.group) - Number(b.group))
      );
      throw new Error("Didn't get goal word in 6 guesses");
    }
    attemptCountList.push(pastGuesses.length);
    console.log("\n");
  }

  const endTime = performance.now();

  // calculate amount of time to complete all games in seconds
  const timeToComplete = (endTime - startTime) / 1000;

  console.log(`\n===============\n`);

  const counts = attemptCountList.reduce(
    (acc, attempts) => {
      acc[attempts] = (acc[attempts] || 0) + 1;
      return acc;
    },
    [0, 0, 0] as number[]
  );

  console.log(babar(Array.from(counts.entries())));

  const sortedAttemptsList = attemptCountList.sort((a, b) => b - a);
  const maxAttempts = sortedAttemptsList[0];
  const minAttempts = sortedAttemptsList[sortedAttemptsList.length - 1];
  const averageAttemptsPerGame = attemptCountList.reduce(
    (acc, v) => acc + v / attemptCountList.length,
    0
  );

  console.table({
    maxAttempts,
    minAttempts,
    averageAttemptsPerGame,
    totalGamesPlayed: attemptCountList.length,
    timeToComplete,
  });
};

playGame();
