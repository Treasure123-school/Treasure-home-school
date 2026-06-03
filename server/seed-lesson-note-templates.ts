/**
 * Seed file for Lesson Note Library Templates
 * 
 * Contains original lesson note templates based on the Nigerian National Curriculum
 * (NERDC/FME). All content is original and written for educational purposes.
 * Topics follow the standard Nigerian curriculum structure.
 */

import { db } from "./storage";
import { lessonNoteTemplates } from "@shared/schema.pg";
import { eq, and } from "drizzle-orm";

interface TemplateData {
  title: string;
  level: string;
  className: string;
  subjectName: string;
  term: string;
  weekNumber: number;
  topic: string;
  duration: string;
  objectives: string;
  entryBehaviour: string;
  instructionalMaterials: string;
  content: string;
  teacherActivities: string;
  studentActivities: string;
  evaluationQuestions: string;
  assignments: string;
  references: string;
}

const TEMPLATES: TemplateData[] = [
  // ── JSS 1 ──────────────────────────────────────────────────────────────────
  {
    title: "JSS 1 English Language – Introduction to Language",
    level: "jss",
    className: "JSS 1",
    subjectName: "English Language",
    term: "first",
    weekNumber: 1,
    topic: "Introduction to Language: Definition and Functions",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define language in their own words.\n2. Identify at least four major functions of language.\n3. Distinguish between verbal and non-verbal communication.\n4. Give examples of how language is used in everyday life.",
    entryBehaviour:
      "Students should already know how to communicate in at least one Nigerian language and have basic reading ability in English.",
    instructionalMaterials:
      "Textbook (New Oxford Secondary English Book 1), chart showing functions of language, pictures illustrating verbal and non-verbal communication, whiteboard and markers.",
    content:
      "DEFINITION OF LANGUAGE\nLanguage is a structured system of communication that uses sounds, symbols, signs, or gestures to convey meaning between individuals or groups. It is the primary tool humans use to express thoughts, feelings, and ideas.\n\nFUNCTIONS OF LANGUAGE\n1. Communicative Function: Language enables people to exchange information, ideas, and feelings.\n2. Expressive Function: Language allows individuals to express emotions — joy, anger, sadness, and love.\n3. Directive Function: Language is used to give instructions, commands, and requests (e.g., 'Sit down,' 'Open your book').\n4. Informative Function: Language conveys facts and knowledge (e.g., news reports, textbooks).\n5. Phatic Function: Language is used for social bonding and maintaining relationships (e.g., greetings — 'Good morning').\n6. Poetic/Aesthetic Function: Language is used creatively in literature, poetry, and songs.\n\nTYPES OF COMMUNICATION\n• Verbal Communication: Using spoken or written words.\n• Non-verbal Communication: Using body language, facial expressions, gestures, and signs.",
    teacherActivities:
      "Step 1 (5 min): Greet students and introduce the topic. Ask students: 'How did you greet your parents this morning?' Use responses to lead into the definition of language.\nStep 2 (10 min): Write the definition on the board. Explain each part of the definition with examples.\nStep 3 (15 min): Display the chart showing functions of language. Explain each function with relatable examples from students' daily lives.\nStep 4 (7 min): Use pictures to distinguish verbal from non-verbal communication. Ask students to identify which type is shown in each picture.\nStep 5 (3 min): Summarise the lesson. Ask evaluation questions.",
    studentActivities:
      "• Listen attentively and take notes.\n• Answer the teacher's opening questions about morning greetings.\n• Copy the definition of language from the board.\n• Study the chart on functions of language.\n• Look at pictures and identify whether communication is verbal or non-verbal.\n• Participate in class discussion.",
    evaluationQuestions:
      "1. What is language?\n2. State and explain THREE functions of language with examples.\n3. What is the difference between verbal and non-verbal communication? Give one example of each.\n4. Give two examples of the phatic function of language you have used today.",
    assignments:
      "In your exercise book:\n1. Write a short paragraph (5–8 sentences) about a conversation you had today. Identify which functions of language were used.\n2. List three non-verbal communication signals you see people use at home or in school.",
    references:
      "1. Idowu, P. et al. (2021). New Oxford Secondary English Book 1. Oxford University Press.\n2. Federal Ministry of Education (2012). Senior Secondary School Curriculum: English Language. NERDC.\n3. Crystal, D. (2010). The Cambridge Encyclopedia of Language. Cambridge University Press.",
  },
  {
    title: "JSS 1 English Language – Parts of Speech: Nouns",
    level: "jss",
    className: "JSS 1",
    subjectName: "English Language",
    term: "first",
    weekNumber: 2,
    topic: "Parts of Speech: Nouns – Definition and Types",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define a noun.\n2. Identify and classify at least four types of nouns.\n3. Use different types of nouns correctly in sentences.\n4. Identify nouns in a given passage.",
    entryBehaviour:
      "Students should know that language is made up of words and have a basic understanding of sentences.",
    instructionalMaterials:
      "Textbook, word cards (common, proper, abstract, collective nouns), whiteboard, markers, sentence strips.",
    content:
      "DEFINITION OF A NOUN\nA noun is a word used to name a person, animal, place, thing, or idea.\n\nTYPES OF NOUNS\n1. Common Nouns: General names for people, places, or things.\n   Examples: teacher, city, book, dog\n\n2. Proper Nouns: Specific names of particular persons, places, or organisations. They begin with capital letters.\n   Examples: Lagos, Emeka, Nigeria, Monday\n\n3. Abstract Nouns: Names of ideas, qualities, feelings, or states that cannot be seen or touched.\n   Examples: love, courage, happiness, wisdom, justice\n\n4. Collective Nouns: Words that refer to groups of people, animals, or things as a whole.\n   Examples: a flock of birds, a herd of cattle, a class of students, a bunch of keys\n\n5. Countable Nouns: Nouns that can be counted and have both singular and plural forms.\n   Examples: book/books, child/children, mango/mangoes\n\n6. Uncountable Nouns: Nouns that cannot normally be counted or pluralised.\n   Examples: water, rice, sand, information",
    teacherActivities:
      "Step 1 (5 min): Review previous lesson on language. Introduce nouns by asking 'What words name things around us?'\nStep 2 (10 min): Define nouns and write examples on the board. Display word cards.\nStep 3 (15 min): Explain each type of noun with examples. Write examples on the board in categorised columns.\nStep 4 (7 min): Give students sentence strips. Ask them to identify and classify the nouns in each sentence.\nStep 5 (3 min): Summarise and pose evaluation questions.",
    studentActivities:
      "• Review notes from previous lesson.\n• Provide examples of things they can name in the classroom.\n• Copy the definition and types of nouns.\n• Sort word cards into correct noun categories.\n• Identify and classify nouns in given sentences.",
    evaluationQuestions:
      "1. Define a noun and give three examples.\n2. What is the difference between a common noun and a proper noun? Give two examples of each.\n3. Pick out all the nouns in this sentence and state their types: 'A flock of birds flew over Lagos, and the children watched with joy.'\n4. Give two examples each of countable and uncountable nouns.",
    assignments:
      "1. Write five sentences, each containing a different type of noun. Underline the noun and write its type beside each sentence.\n2. From your English textbook, page 12, identify 10 nouns from the passage and classify them.",
    references:
      "1. Idowu, P. et al. (2021). New Oxford Secondary English Book 1. Oxford University Press.\n2. Oluikpe, B. O. A. (2018). Comprehensive English for JSS 1. Africana-FIRST Publishers.\n3. Quirk, R. et al. (1985). A Comprehensive Grammar of the English Language. Longman.",
  },
  {
    title: "JSS 1 Mathematics – Whole Numbers and Place Value",
    level: "jss",
    className: "JSS 1",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 1,
    topic: "Whole Numbers: Counting, Writing, and Place Value",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Count and write whole numbers up to one million.\n2. State the place value of digits in any whole number.\n3. Write numbers in words and in figures.\n4. Compare and order whole numbers.",
    entryBehaviour:
      "Students should be able to count up to 1000 and have basic understanding of the number system from primary school.",
    instructionalMaterials:
      "Abacus, place value chart (ones, tens, hundreds, thousands, ten-thousands, hundred-thousands, millions), number cards, whiteboard and markers.",
    content:
      "THE NUMBER SYSTEM\nWhole numbers are numbers without fractions or decimals: 0, 1, 2, 3, 4, ...\n\nPLACE VALUE\nEvery digit in a number has a place value depending on its position.\n\nPlace value chart:\n| Millions | Hundred-Thousands | Ten-Thousands | Thousands | Hundreds | Tens | Ones |\n|----------|-------------------|---------------|-----------|----------|------|------|\n| 1,000,000 | 100,000 | 10,000 | 1,000 | 100 | 10 | 1 |\n\nExample: In the number 3,456,789\n• 3 is in the millions place (value = 3,000,000)\n• 4 is in the hundred-thousands place (value = 400,000)\n• 5 is in the ten-thousands place (value = 50,000)\n• 6 is in the thousands place (value = 6,000)\n• 7 is in the hundreds place (value = 700)\n• 8 is in the tens place (value = 80)\n• 9 is in the ones place (value = 9)\n\nWRITING NUMBERS IN WORDS\n456,789 = Four hundred and fifty-six thousand, seven hundred and eighty-nine\n\nCOMPARING NUMBERS\nUse the symbols: > (greater than), < (less than), = (equal to)\nExample: 4,520 > 4,250 because 4,520 has 5 in the hundreds place while 4,250 has 2.",
    teacherActivities:
      "Step 1 (5 min): Ask students to count from 990 to 1010. Introduce the concept of place value.\nStep 2 (10 min): Display the place value chart. Explain each column using the abacus.\nStep 3 (12 min): Work through examples on the board. Demonstrate how to read and write large numbers.\nStep 4 (10 min): Ask students to solve problems at the board: reading numbers, writing in words, identifying place values.\nStep 5 (3 min): Summarise key concepts. Ask evaluation questions.",
    studentActivities:
      "• Count aloud with the teacher.\n• Study the place value chart and copy it.\n• Participate in board exercises.\n• Solve given problems in their exercise books.\n• Verify answers with classmates.",
    evaluationQuestions:
      "1. Write the place value of the underlined digit: 5_7_3,416 (underline 7 and 3)\n2. Write 1,245,308 in words.\n3. Write 'Eight hundred and forty-two thousand, six hundred and fifteen' in figures.\n4. Arrange in ascending order: 34,210; 43,012; 34,021; 43,120",
    assignments:
      "1. Write the place value of each digit in the number 2,738,465.\n2. Write these numbers in words: (a) 509,300 (b) 1,000,000 (c) 87,654\n3. Write these in figures: (a) Three million, four hundred and twenty thousand and six (b) Ninety-nine thousand, nine hundred and ninety-nine",
    references:
      "1. Tuttuh-Adegun, J. A. et al. (2019). New General Mathematics for JSS 1. Longman.\n2. Channon, J. B. et al. (2017). New General Mathematics for West Africa Book 1. Longman.\n3. Federal Ministry of Education (2012). Mathematics Curriculum for Junior Secondary Schools. NERDC.",
  },
  {
    title: "JSS 1 Mathematics – Basic Operations",
    level: "jss",
    className: "JSS 1",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 2,
    topic: "Basic Operations on Whole Numbers: Addition and Subtraction",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Add whole numbers of up to 7 digits without a calculator.\n2. Subtract whole numbers of up to 7 digits.\n3. Apply addition and subtraction to solve word problems.\n4. Verify answers by reversing operations.",
    entryBehaviour:
      "Students should know place value and be able to add and subtract three-digit numbers.",
    instructionalMaterials:
      "Whiteboard and markers, number cards, calculator (for verification only), worked examples chart.",
    content:
      "ADDITION OF WHOLE NUMBERS\nRules:\n• Arrange numbers in columns: ones under ones, tens under tens, etc.\n• Add from right to left (ones first).\n• Carry over to the next column when the sum is 10 or more.\n\nExample: 456,789 + 273,456\n  456,789\n+ 273,456\n---------\n  730,245\n\nSUBTRACTION OF WHOLE NUMBERS\nRules:\n• Arrange in columns.\n• Subtract from right to left.\n• Borrow from the next column when the digit being subtracted is larger.\n\nExample: 500,000 - 163,547\n  500,000\n- 163,547\n---------\n  336,453\n\nVERIFICATION: To verify subtraction, add the answer back to the number subtracted:\n336,453 + 163,547 = 500,000 ✓\n\nWORD PROBLEMS\nExample: A school has 3,456 students. During holidays, 789 students travelled. How many students remained?\nSolution: 3,456 - 789 = 2,667 students",
    teacherActivities:
      "Step 1 (5 min): Recall previous lesson on place value. Demonstrate the column method of addition.\nStep 2 (10 min): Solve three examples of large-number addition on the board with student participation.\nStep 3 (10 min): Introduce subtraction. Explain borrowing using a concrete example.\nStep 4 (10 min): Solve word problems together. Ask one student to come to the board.\nStep 5 (5 min): Summarise and give evaluation questions.",
    studentActivities:
      "• Recall place value from previous lesson.\n• Copy worked examples.\n• Solve problems individually, then compare with a partner.\n• Volunteer to solve problems at the board.",
    evaluationQuestions:
      "1. Calculate: 753,218 + 146,783\n2. Calculate: 900,000 – 348,675\n3. A farmer harvested 127,540 tomatoes. He sold 89,765. How many are left?\n4. Two towns are 345,670 m and 129,850 m from a city respectively. What is the total distance?",
    assignments:
      "1. Compute: (a) 1,234,567 + 876,433 (b) 2,000,000 − 1,456,789\n2. A school library has 24,380 books. 5,629 books were damaged. How many books remain?\n3. Create your own addition word problem using numbers above 100,000 and solve it.",
    references:
      "1. Tuttuh-Adegun, J. A. et al. (2019). New General Mathematics for JSS 1. Longman.\n2. Channon, J. B. et al. (2017). New General Mathematics for West Africa Book 1. Longman.",
  },
  {
    title: "JSS 1 Basic Science – Introduction to Science",
    level: "jss",
    className: "JSS 1",
    subjectName: "Basic Science",
    term: "first",
    weekNumber: 1,
    topic: "Introduction to Basic Science: Meaning, Branches, and Importance",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define science and explain what Basic Science is.\n2. Identify at least five major branches of science.\n3. State at least four reasons why science is important.\n4. Describe at least three careers in science.",
    entryBehaviour:
      "Students should have studied Basic Science at primary school and be able to name some common scientific objects.",
    instructionalMaterials:
      "Basic Science textbook (JSS 1), chart showing branches of science, pictures of scientists at work, specimens of common materials (stone, water, plant leaf).",
    content:
      "WHAT IS SCIENCE?\nScience is a systematic study of the natural world through observation, experimentation, and evidence. It is the body of knowledge gained from studying the physical and natural world.\n\nBasic Science is the simplified study of scientific principles and concepts at the junior secondary school level. It introduces students to Biology, Chemistry, Physics, and related fields.\n\nMAJOR BRANCHES OF SCIENCE\n1. Biology: The study of living organisms — plants, animals, and microorganisms.\n2. Chemistry: The study of matter, its properties, composition, and reactions.\n3. Physics: The study of energy, forces, and the physical properties of matter.\n4. Earth Science (Geology/Geography): The study of the Earth, its structure, and natural processes.\n5. Astronomy: The study of celestial bodies — stars, planets, moons.\n6. Environmental Science: The study of the environment and how living things interact with it.\n\nIMPORTANCE OF SCIENCE\n1. Improves healthcare: Medical discoveries save millions of lives.\n2. Advances technology: Computers, phones, and machines are products of science.\n3. Improves food production: Agricultural science increases crop yields.\n4. Protects the environment: Environmental science guides conservation efforts.\n5. Develops critical thinking: Science trains the mind to solve problems systematically.\n\nCAREERS IN SCIENCE\nDoctor, Engineer, Pharmacist, Laboratory Scientist, Agricultural Officer, Environmental Scientist, Astronaut, Geologist.",
    teacherActivities:
      "Step 1 (5 min): Show students a plant leaf, a stone, and a cup of water. Ask: 'What do these have in common?' Lead into the definition of science.\nStep 2 (10 min): Define science and Basic Science. Write definitions on the board.\nStep 3 (12 min): Display the chart of branches. Explain each branch with real-life examples.\nStep 4 (8 min): Discuss the importance of science and science careers using pictures.\nStep 5 (5 min): Evaluate students with oral questions. Summarise the lesson.",
    studentActivities:
      "• Examine the specimens provided (leaf, stone, water).\n• Listen and take notes on definitions.\n• Study the branches of science chart.\n• Participate in discussions about science importance.\n• Answer oral evaluation questions.",
    evaluationQuestions:
      "1. What is science? Write the definition in your own words.\n2. Name five branches of science and briefly explain what each one studies.\n3. Give three reasons why science is important to society.\n4. Name two science careers and describe what each professional does.",
    assignments:
      "1. In your exercise book, draw a mind map showing at least six branches of science.\n2. Write a paragraph (5–8 sentences) on how science has improved life in Nigeria.\n3. Interview a family member who uses science in their job and write a brief report.",
    references:
      "1. Olawuyi, T. (2020). Comprehensive Basic Science for JSS 1. University Press.\n2. Federal Ministry of Education (2012). Basic Science Curriculum for JSS 1–3. NERDC.\n3. Wikipedia (2024). Science. Retrieved from https://en.wikipedia.org/wiki/Science",
  },
  {
    title: "JSS 1 Computer Studies – Introduction to Computers",
    level: "jss",
    className: "JSS 1",
    subjectName: "Computer Studies",
    term: "first",
    weekNumber: 1,
    topic: "Introduction to Computers: Meaning, History, and Characteristics",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define a computer and explain how it works.\n2. Outline the brief history of computers (4 key generations).\n3. State at least five characteristics of a computer.\n4. Identify the main areas where computers are used.",
    entryBehaviour:
      "Students should have seen a computer before and know it is used for work. They may have basic experience using phones or tablets.",
    instructionalMaterials:
      "Computer or laptop (for demonstration), projector or large display screen, picture cards of computer generations (ENIAC, mainframe, PC, laptop), whiteboard.",
    content:
      "WHAT IS A COMPUTER?\nA computer is an electronic device that accepts data as input, processes it according to a set of instructions (program), stores information, and produces results as output.\n\nKey elements:\n• Input: Data entered into the computer (e.g., typing on a keyboard).\n• Processing: The computer performs calculations or operations on the data (done by the CPU).\n• Output: The result is displayed or printed (e.g., on a screen).\n• Storage: Data can be saved for later use.\n\nBRIEF HISTORY OF COMPUTERS\nFirst Generation (1940s–1950s): Used vacuum tubes. Very large and slow. Example: ENIAC.\nSecond Generation (1950s–1960s): Used transistors. Smaller and faster.\nThird Generation (1960s–1970s): Used integrated circuits. Even faster and more reliable.\nFourth Generation (1970s–present): Used microprocessors. Personal computers, laptops, and smartphones.\n\nCHARACTERISTICS OF A COMPUTER\n1. Speed: Performs millions of operations per second.\n2. Accuracy: Produces error-free results when given correct instructions.\n3. Storage: Can store large amounts of data.\n4. Versatility: Can perform many different tasks.\n5. Diligence: Works non-stop without fatigue.\n6. Automation: Follows instructions automatically.\n\nUSES OF COMPUTERS\n• Education: E-learning, research.\n• Healthcare: Patient records, diagnosis.\n• Banking: Online transactions.\n• Communication: Emails, social media.\n• Entertainment: Games, movies.\n• Business: Accounting, management.",
    teacherActivities:
      "Step 1 (5 min): Ask students what they know about computers. Introduce the topic.\nStep 2 (8 min): Define a computer and explain the input-process-output cycle.\nStep 3 (12 min): Use picture cards to walk through the four generations of computers.\nStep 4 (10 min): List and explain characteristics of a computer with demonstrations on the actual computer.\nStep 5 (5 min): Discuss uses of computers. Ask evaluation questions.",
    studentActivities:
      "• Share what they know about computers.\n• Copy the definition and I-P-O cycle.\n• Study picture cards of computer generations.\n• Participate in listing characteristics with examples.\n• Observe demonstrations on the computer.",
    evaluationQuestions:
      "1. Define a computer in your own words.\n2. What are the three main stages in computer processing? Explain each briefly.\n3. State any FOUR characteristics of a computer.\n4. Name THREE areas where computers are used and give one example from each area.",
    assignments:
      "1. Draw and label a simple diagram showing the input-process-output cycle.\n2. Research and write a short paragraph on each of the four generations of computers.\n3. List five devices you use at home that have computer chips inside them.",
    references:
      "1. Abass, O. A. (2020). Computer Studies for JSS 1. TONAD Publishers.\n2. Federal Ministry of Education (2012). Computer Studies Curriculum for JSS 1–3. NERDC.\n3. Norton, P. (2018). Introduction to Computers. McGraw-Hill Education.",
  },

  // ── JSS 2 ──────────────────────────────────────────────────────────────────
  {
    title: "JSS 2 Mathematics – Directed Numbers",
    level: "jss",
    className: "JSS 2",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 1,
    topic: "Directed Numbers (Integers): Introduction and Number Line",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define directed numbers (integers).\n2. Represent integers on a number line.\n3. Identify positive and negative integers.\n4. Compare and order integers.\n5. Apply integers to real-life situations (temperature, floors above/below ground).",
    entryBehaviour:
      "Students should be able to count and perform basic operations on whole numbers.",
    instructionalMaterials:
      "Number line chart (ranging from −10 to +10), thermometer diagram, whiteboard and markers, integer cards.",
    content:
      "DIRECTED NUMBERS (INTEGERS)\nDirected numbers are numbers that have both a size (magnitude) and a direction (positive or negative). They are also called integers.\n\nPositive integers: Numbers greater than zero (+1, +2, +3, ... or simply 1, 2, 3, ...)\nNegative integers: Numbers less than zero (−1, −2, −3, ...)\nZero (0): Neither positive nor negative.\n\nTHE NUMBER LINE\nA number line shows integers in order, with negative numbers to the left of zero and positive numbers to the right.\n\n←−−−−−−−−−−−−−−−−−−−−→\n−5 −4 −3 −2 −1  0  1  2  3  4  5\n\nAs we move RIGHT on the number line, numbers INCREASE.\nAs we move LEFT, numbers DECREASE.\n\nCOMPARING INTEGERS\n−2 > −5 (because −2 is to the right of −5 on the number line)\n−1 < 3 (because −1 is to the left of 3)\n\nREAL-LIFE APPLICATIONS\n• Temperature: −5°C means 5 degrees below zero.\n• Floors: −1 means one floor below ground (basement).\n• Finance: −₦500 means a debt of ₦500.\n• Sea level: −200 m means 200 metres below sea level.",
    teacherActivities:
      "Step 1 (5 min): Ask about temperature in cold countries. When is temperature 'below zero'? Introduce negative numbers.\nStep 2 (10 min): Draw a large number line on the board. Explain positive, negative, and zero.\nStep 3 (12 min): Demonstrate comparing integers using the number line. Show that a number further right is always greater.\nStep 4 (8 min): Give real-life examples. Ask students to place values on the number line.\nStep 5 (5 min): Evaluate and summarise.",
    studentActivities:
      "• Discuss temperatures in cold countries.\n• Draw the number line in their books.\n• Place given integers on the number line.\n• Compare pairs of integers using > and < symbols.\n• Give examples of negative numbers from real life.",
    evaluationQuestions:
      "1. What are directed numbers? Give two examples of positive and two examples of negative integers.\n2. Draw a number line from −6 to +6 and mark the following: −4, 2, −1, 5, 0.\n3. Arrange in ascending order: −3, 7, −8, 1, 0, −1.\n4. A submarine is at −150 m and a plane is at +8,500 m. What is the difference in their positions?",
    assignments:
      "1. Write five real-life situations where you would use negative numbers.\n2. Arrange in descending order: −12, 5, −3, 0, 8, −7, 4.\n3. On a number line, mark: the temperature today (use a positive number), the temperature in Antarctica in winter (approximately −60°C), and sea level (0).",
    references:
      "1. Tuttuh-Adegun, J. A. et al. (2019). New General Mathematics for JSS 2. Longman.\n2. Channon, J. B. et al. (2017). New General Mathematics for West Africa Book 2. Longman.",
  },
  {
    title: "JSS 2 Basic Science – Matter and Its Properties",
    level: "jss",
    className: "JSS 2",
    subjectName: "Basic Science",
    term: "first",
    weekNumber: 1,
    topic: "Matter: Definition, States, and Properties",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define matter and explain that everything around us is made of matter.\n2. Describe the three states of matter with examples.\n3. State the properties of solids, liquids, and gases.\n4. Give real-life examples of changes between states of matter.",
    entryBehaviour:
      "Students should be able to identify common materials as solid, liquid, or gas from everyday experience.",
    instructionalMaterials:
      "Specimens of solid (stone, wood), liquid (water in a container), and gas (air in a balloon), candle and match, ice cubes, whiteboard and markers.",
    content:
      "WHAT IS MATTER?\nMatter is anything that has mass and occupies space (has volume). Everything you can see, touch, smell, or taste is made of matter.\n\nExamples of matter: water, air, rock, soil, wood, human body.\nNon-examples (not matter): heat, light, emotions, sound.\n\nSTATES OF MATTER\n1. SOLID\n   • Has a definite shape and definite volume.\n   • Particles are closely packed and vibrate in fixed positions.\n   • Examples: rock, wood, iron, ice.\n   • Properties: hard, rigid, does not flow.\n\n2. LIQUID\n   • Has a definite volume but no definite shape (takes the shape of its container).\n   • Particles are close together but move more freely.\n   • Examples: water, oil, mercury, milk.\n   • Properties: flows, has a surface level, can be poured.\n\n3. GAS\n   • Has no definite shape or volume (fills the container it is in).\n   • Particles are far apart and move rapidly in all directions.\n   • Examples: oxygen, carbon dioxide, steam.\n   • Properties: can be compressed, spreads out, has no fixed shape.\n\nCHANGES IN STATE\n• Melting: Solid → Liquid (heat is added). Example: ice → water.\n• Evaporation/Boiling: Liquid → Gas (heat is added). Example: water → steam.\n• Condensation: Gas → Liquid (cooled). Example: steam → water.\n• Freezing: Liquid → Solid (cooled). Example: water → ice.",
    teacherActivities:
      "Step 1 (5 min): Hold up the stone, water, and balloon of air. Ask: 'What do these have in common?'\nStep 2 (8 min): Define matter. Show what is and is not matter. Pupils contribute examples.\nStep 3 (15 min): Explain each state with specimens. Pass the specimens around for students to observe.\nStep 4 (7 min): Use ice cubes and candle to demonstrate melting and evaporation.\nStep 5 (5 min): Evaluate and summarise.",
    studentActivities:
      "• Observe and handle specimens.\n• Contribute examples of matter.\n• Describe what they observe about each state.\n• Watch the melting/evaporation demonstrations.\n• Take notes and draw diagrams of particle arrangements.",
    evaluationQuestions:
      "1. Define matter and give four examples.\n2. What are the three states of matter? Describe the shape and volume of each.\n3. State two properties of a solid and two properties of a gas.\n4. What change of state occurs when: (a) ice is left in the sun? (b) water is put in a freezer? (c) steam is cooled?",
    assignments:
      "1. Draw diagrams showing the particle arrangement in solids, liquids, and gases.\n2. List five examples each of: solid, liquid, and gas that you find in your kitchen at home.\n3. Describe what happens to water when it is heated from room temperature to boiling point.",
    references:
      "1. Olawuyi, T. (2020). Comprehensive Basic Science for JSS 2. University Press.\n2. Federal Ministry of Education (2012). Basic Science Curriculum for JSS 1–3. NERDC.",
  },

  // ── SS 1 ───────────────────────────────────────────────────────────────────
  {
    title: "SS 1 Mathematics – Number Bases",
    level: "ss",
    className: "SS 1",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 1,
    topic: "Number Bases: Introduction and Conversion",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Explain the concept of number bases.\n2. Convert numbers from base 10 to base 2, 5, and 8.\n3. Convert numbers from other bases to base 10.\n4. Perform simple addition in different bases.",
    entryBehaviour:
      "Students should understand place value and be able to perform basic operations on whole numbers in base 10.",
    instructionalMaterials:
      "Place value chart for different bases, whiteboard, worked examples chart, calculators (for verification only).",
    content:
      "NUMBER BASES\nIn everyday life, we use Base 10 (Denary). This means we use 10 digits: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.\nA base-n number system uses n digits: 0 through (n−1).\n\nCommon bases:\n• Base 2 (Binary): Digits 0, 1 — used in computers.\n• Base 5 (Quinary): Digits 0, 1, 2, 3, 4.\n• Base 8 (Octal): Digits 0, 1, 2, 3, 4, 5, 6, 7.\n• Base 10 (Decimal): Digits 0–9.\n• Base 16 (Hexadecimal): Digits 0–9, A–F.\n\nCONVERTING FROM BASE 10 TO ANOTHER BASE\nMethod: Repeatedly divide by the base and record remainders.\n\nExample: Convert 45₁₀ to base 2.\n45 ÷ 2 = 22 remainder 1\n22 ÷ 2 = 11 remainder 0\n11 ÷ 2 = 5  remainder 1\n5  ÷ 2 = 2  remainder 1\n2  ÷ 2 = 1  remainder 0\n1  ÷ 2 = 0  remainder 1\nRead remainders upward: 45₁₀ = 101101₂\n\nCONVERTING FROM ANOTHER BASE TO BASE 10\nMethod: Multiply each digit by its place value (base raised to its position).\n\nExample: Convert 101101₂ to base 10.\n= 1×2⁵ + 0×2⁴ + 1×2³ + 1×2² + 0×2¹ + 1×2⁰\n= 32 + 0 + 8 + 4 + 0 + 1\n= 45₁₀",
    teacherActivities:
      "Step 1 (5 min): Review place value concept. Ask: 'What does the digit 3 in 3,456 represent?'\nStep 2 (10 min): Introduce number bases. Explain binary as used in computers. Show how different bases work.\nStep 3 (15 min): Demonstrate conversion from base 10 to base 2 using division method. Work through 3 examples.\nStep 4 (7 min): Demonstrate conversion from base 2 to base 10. Work through 2 examples.\nStep 5 (3 min): Summarise and give evaluation questions.",
    studentActivities:
      "• Recall place value from previous year.\n• Take notes on number bases.\n• Observe the conversion demonstrations.\n• Attempt conversion problems in their exercise books.\n• Share answers with classmates.",
    evaluationQuestions:
      "1. Convert 36₁₀ to base 2.\n2. Convert 110111₂ to base 10.\n3. Convert 75₁₀ to base 5.\n4. Convert 234₅ to base 10.",
    assignments:
      "1. Convert the following to base 2: (a) 20 (b) 47 (c) 100\n2. Convert to base 10: (a) 1010₂ (b) 11001₂ (c) 321₅\n3. Add in base 2: 101 + 110",
    references:
      "1. Adelodun, A. O. (2018). New General Mathematics for SS1. Longman.\n2. Channon, J. B. et al. (2017). New General Mathematics for West Africa SS1. Longman.\n3. Federal Ministry of Education (2012). Senior Secondary Mathematics Curriculum. NERDC.",
  },
  {
    title: "SS 1 Biology – Cell Biology",
    level: "ss",
    className: "SS 1",
    subjectName: "Biology",
    term: "first",
    weekNumber: 1,
    topic: "The Cell: Structure and Functions of Cell Organelles",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define the cell as the basic unit of life.\n2. Distinguish between plant and animal cells.\n3. Label a diagram of a plant and animal cell.\n4. State the functions of at least six cell organelles.\n5. Explain the difference between prokaryotic and eukaryotic cells.",
    entryBehaviour:
      "Students should know that living things are made of cells from their JSS level studies.",
    instructionalMaterials:
      "Large labelled diagrams of plant and animal cells, microscope (if available), onion skin/cheek cell slides, Biology textbook (SS 1), whiteboard.",
    content:
      "THE CELL\nThe cell is the basic structural and functional unit of all living organisms. All living things are made up of one or more cells.\n\nTYPES OF CELLS\n1. Prokaryotic cells: No membrane-bound nucleus. Example: bacteria.\n2. Eukaryotic cells: Have a membrane-bound nucleus. Example: plant and animal cells.\n\nSTRUCTURE OF AN ANIMAL CELL\n• Cell membrane: Controls what enters and leaves the cell.\n• Nucleus: Controls cell activities; contains DNA.\n• Cytoplasm: Jelly-like fluid where organelles are suspended.\n• Mitochondria: Site of cellular respiration; produces ATP (energy).\n• Ribosomes: Sites of protein synthesis.\n• Endoplasmic Reticulum (ER): Transport system within the cell.\n• Golgi Body/Apparatus: Packages and exports proteins.\n• Lysosomes: Digest waste materials.\n• Vacuoles: Storage of water and food materials.\n\nADDITIONAL STRUCTURES IN PLANT CELLS\n• Cell wall: Rigid outer layer; provides support and shape (made of cellulose).\n• Chloroplasts: Contain chlorophyll; site of photosynthesis.\n• Large central vacuole: Provides turgor pressure.\n\nDIFFERENCES: PLANT vs ANIMAL CELLS\n| Feature       | Plant Cell           | Animal Cell         |\n|---------------|----------------------|---------------------|\n| Cell wall     | Present              | Absent              |\n| Chloroplasts  | Present              | Absent              |\n| Vacuole       | Large, permanent     | Small, temporary    |\n| Shape         | Regular              | Irregular           |",
    teacherActivities:
      "Step 1 (5 min): Ask: 'What is the smallest living unit?' Lead into cell definition.\nStep 2 (8 min): Explain prokaryotic vs eukaryotic cells briefly.\nStep 3 (15 min): Display diagrams. Point to and explain each organelle — animal cell first, then plant cell.\nStep 4 (8 min): Compare plant and animal cells using the table. Emphasise key differences.\nStep 5 (4 min): Evaluate and summarise. Assign homework.",
    studentActivities:
      "• Contribute answers to opening question.\n• Listen and take notes on cell types.\n• Study cell diagrams; label diagrams in their books.\n• Identify differences between plant and animal cells from the diagrams.\n• Answer evaluation questions.",
    evaluationQuestions:
      "1. What is a cell? Why is it called the 'basic unit of life'?\n2. Draw and label a diagram of an animal cell showing at least five organelles.\n3. State the functions of: (a) mitochondria (b) nucleus (c) cell membrane (d) ribosomes.\n4. List THREE structural differences between plant and animal cells.",
    assignments:
      "1. Draw a well-labelled diagram of a plant cell and state the function of each labelled part.\n2. Research and write a short paragraph on how the discovery of the microscope helped scientists understand cells.\n3. Make a table comparing prokaryotic and eukaryotic cells under four headings.",
    references:
      "1. Ifeoma Okafor (2019). Biology for Senior Secondary Schools Book 1. University Press.\n2. Soper, R. et al. (2018). Senior Secondary Biology for Nigeria. Longman.\n3. Federal Ministry of Education (2012). Senior Secondary Biology Curriculum. NERDC.",
  },
  {
    title: "SS 1 Economics – Introduction to Economics",
    level: "ss",
    className: "SS 1",
    subjectName: "Economics",
    term: "first",
    weekNumber: 1,
    topic: "Introduction to Economics: Definition, Scope, and Basic Concepts",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define Economics and explain what economists study.\n2. Explain the concept of scarcity and choice.\n3. Identify the three basic economic problems facing societies.\n4. Distinguish between Microeconomics and Macroeconomics.",
    entryBehaviour:
      "Students should understand that people have needs and wants and that resources (money, time) are limited.",
    instructionalMaterials:
      "Economics textbook (SS 1), chart showing types of economic systems, newspaper articles about Nigerian economy, whiteboard.",
    content:
      "DEFINITION OF ECONOMICS\nEconomics is the social science that studies how individuals, firms, governments, and societies make decisions about the allocation of limited (scarce) resources to satisfy unlimited wants.\n\nSCARCITY AND CHOICE\nScarcity: Resources (land, labour, capital) are limited but human wants are unlimited. This creates scarcity.\nChoice: Because of scarcity, individuals and societies must make choices about how to use resources.\nOpportunity Cost: The next best alternative given up when a choice is made.\nExample: If you spend ₦5,000 on a new shirt instead of saving it, the opportunity cost is the saving.\n\nTHREE BASIC ECONOMIC PROBLEMS\nEvery economy faces three fundamental questions:\n1. WHAT to produce? (Which goods and services?)\n2. HOW to produce? (Which production methods?)\n3. FOR WHOM to produce? (Who gets the goods and services?)\n\nBRANCHES OF ECONOMICS\n1. Microeconomics: Studies individual units — households, firms, specific markets. Topics: demand, supply, pricing.\n2. Macroeconomics: Studies the economy as a whole — national income, inflation, unemployment, GDP.\n\nWHY STUDY ECONOMICS?\n• Helps individuals make better financial decisions.\n• Guides government policy-making.\n• Explains causes of poverty and how to address them.\n• Helps businesses plan and maximise profits.",
    teacherActivities:
      "Step 1 (5 min): Ask: 'Have you ever wanted to buy something but didn't have enough money?' Use responses to introduce scarcity.\nStep 2 (10 min): Define economics. Explain scarcity, choice, and opportunity cost with relatable examples.\nStep 3 (12 min): Explain the three basic economic problems using examples from Nigeria.\nStep 4 (8 min): Distinguish microeconomics from macroeconomics. Give examples of topics in each.\nStep 5 (5 min): Evaluate and summarise.",
    studentActivities:
      "• Share personal examples of wanting something they couldn't afford.\n• Take notes on definitions and concepts.\n• Identify opportunity costs in given scenarios.\n• Discuss which economic problems Nigeria faces.",
    evaluationQuestions:
      "1. Define economics in your own words.\n2. Explain the concept of scarcity and give two examples from Nigerian life.\n3. What are the three basic economic problems? Illustrate each with an example.\n4. What is the difference between microeconomics and macroeconomics?",
    assignments:
      "1. Write a paragraph explaining why opportunity cost is important in personal financial decisions.\n2. Give three examples of macroeconomic problems currently facing Nigeria (use news as a reference).\n3. Define: (a) Economic resources (b) Unlimited wants (c) Allocation of resources.",
    references:
      "1. Anyaele, J. U. (2018). Comprehensive Economics for SS1. Johnson Publishers.\n2. Lipsey, R. G. & Crystal, A. K. (2015). Economics (13th ed.). Oxford University Press.\n3. Federal Ministry of Education (2012). Senior Secondary Economics Curriculum. NERDC.",
  },
  {
    title: "SS 1 English Language – Oral English: Vowel Sounds",
    level: "ss",
    className: "SS 1",
    subjectName: "English Language",
    term: "first",
    weekNumber: 1,
    topic: "Oral English: Vowel Sounds — Pure Vowels (Monophthongs)",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define a vowel sound and explain how it differs from a consonant.\n2. Identify and produce the 12 pure vowel sounds of English.\n3. Give at least two words as examples of each vowel sound.\n4. Transcribe simple words using the International Phonetic Alphabet (IPA).",
    entryBehaviour:
      "Students should know the 26 letters of the English alphabet and have experience reading and speaking English.",
    instructionalMaterials:
      "IPA chart, vowel sound audio recordings (or teacher's voice), pronunciation guide chart, English textbook (SS 1), whiteboard.",
    content:
      "SPEECH SOUNDS\nEnglish speech sounds are divided into vowels and consonants.\nVowel sounds: Produced with an open vocal tract; air flows freely. No obstruction.\nConsonant sounds: Produced with some obstruction of the airflow.\n\nTHE 12 PURE VOWELS (MONOPHTHONGS) OF BRITISH ENGLISH\nSymbol | Mouth Position | Example Words\n/iː/   | Front, close    | see, feet, read\n/ɪ/    | Front, close-mid | sit, bit, fish\n/e/    | Front, mid      | bed, pen, set\n/æ/    | Front, open-mid | cat, bad, man\n/ɑː/   | Back, open      | car, farm, ask\n/ɒ/    | Back, open      | hot, dog, top\n/ɔː/   | Back, open-mid  | door, law, born\n/ʊ/    | Back, close-mid | book, put, foot\n/uː/   | Back, close     | food, cool, moon\n/ʌ/    | Central, mid    | but, cup, run\n/ɜː/   | Central, mid    | bird, her, word\n/ə/    | Central, mid    | about, teacher, the\n\nNote: The /ə/ (schwa) is the most common vowel sound in English.\nTip: Pay attention to the spelling; the same vowel letters can represent different sounds.",
    teacherActivities:
      "Step 1 (5 min): Ask students to say 'a, e, i, o, u'. Explain these are vowel LETTERS, not sounds.\nStep 2 (10 min): Explain vowel vs consonant sounds. Display IPA chart.\nStep 3 (15 min): Demonstrate each of the 12 vowel sounds. Students repeat after the teacher. Focus on sounds that cause difficulty for Nigerian speakers (e.g., /æ/ vs /ɑː/).\nStep 4 (7 min): Give example words. Students sort words into correct vowel sound groups.\nStep 5 (3 min): Evaluate and summarise.",
    studentActivities:
      "• Recite vowel letters.\n• Listen carefully to teacher's pronunciation.\n• Repeat vowel sounds in chorus and individually.\n• Sort word cards into vowel sound categories.\n• Practise transcription of simple words.",
    evaluationQuestions:
      "1. What is a vowel sound? How does it differ from a consonant sound?\n2. Identify the vowel sound in each word: cat, food, bird, cup, door.\n3. Give two words as examples of each: /iː/, /ɑː/, /ʌ/.\n4. What is the schwa sound (/ə/)? Give three words where it occurs.",
    assignments:
      "1. Study the IPA vowel chart and practise the pronunciation of all 12 pure vowels.\n2. Find 3 words containing each of the following sounds: /æ/, /ɔː/, /ɜː/.\n3. Write the phonemic transcription of these words: bed, food, man, bird, cup.",
    references:
      "1. Roach, P. (2009). English Phonetics and Phonology (4th ed.). Cambridge University Press.\n2. Idowu, P. et al. (2021). Senior Secondary English Book 1. Oxford University Press.\n3. Federal Ministry of Education (2012). Senior Secondary English Curriculum. NERDC.",
  },
  {
    title: "SS 1 Chemistry – Separation of Mixtures",
    level: "ss",
    className: "SS 1",
    subjectName: "Chemistry",
    term: "first",
    weekNumber: 1,
    topic: "Separation of Mixtures: Methods and Applications",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define a mixture and distinguish it from a pure substance.\n2. Name and describe at least five methods of separating mixtures.\n3. Identify the appropriate separation method for a given mixture.\n4. Describe simple experiments for separation of mixtures.",
    entryBehaviour:
      "Students should know the difference between elements, compounds, and mixtures from JSS level.",
    instructionalMaterials:
      "Sand and water mixture, salt solution, iron filings and sand mixture, magnet, funnel and filter paper, evaporating dish, Bunsen burner or hot plate (demonstration), whiteboard.",
    content:
      "MIXTURES\nA mixture is a combination of two or more substances that are not chemically combined. The components retain their individual properties and can be separated by physical means.\n\nSEPARATION METHODS\n\n1. FILTRATION\nSeparates an insoluble solid from a liquid using filter paper.\nExample: Separating sand from water.\nEquipment: Filter paper, funnel, beaker.\n\n2. EVAPORATION\nSeparates a dissolved solid from a liquid by heating — the liquid evaporates, leaving the solid.\nExample: Obtaining salt from salt solution.\nEquipment: Evaporating dish, heat source.\n\n3. DISTILLATION\nSeparates a soluble solid or two liquids with different boiling points. The liquid is boiled, vapour is cooled and collected.\nExample: Obtaining pure water from salt water.\n\n4. MAGNETISM\nSeparates a magnetic material from non-magnetic materials using a magnet.\nExample: Separating iron filings from sand.\nEquipment: Bar magnet.\n\n5. DECANTATION\nPouring off a liquid carefully from a settled solid without disturbing the solid.\nExample: Separating clear water from settled mud.\n\n6. CHROMATOGRAPHY\nSeparates coloured substances (pigments, inks) based on how far they travel through a medium.\nExample: Separating dyes in black ink.\nEquipment: Chromatography paper, solvent.\n\n7. CRYSTALLISATION\nObtaining pure crystals of a substance from its saturated solution by slow cooling.\nExample: Obtaining copper sulphate crystals.",
    teacherActivities:
      "Step 1 (5 min): Show students the sand-water and salt-water mixtures. Ask: 'How would you separate these?'\nStep 2 (5 min): Define mixture; compare with pure substances.\nStep 3 (18 min): Explain each separation method. Demonstrate filtration and decantation with equipment. Show the magnet separating iron filings from sand.\nStep 4 (7 min): Ask students to match given mixtures to the correct separation method.\nStep 5 (5 min): Evaluate and summarise.",
    studentActivities:
      "• Observe the mixtures provided.\n• Suggest ways to separate them.\n• Watch demonstrations carefully.\n• Copy diagrams of filtration apparatus.\n• Match mixtures to separation methods.",
    evaluationQuestions:
      "1. What is a mixture? Give three examples.\n2. Describe how you would separate: (a) salt from salt water, (b) iron filings from sand.\n3. What is the difference between evaporation and distillation?\n4. Which method would you use to separate: (a) mud from water, (b) different colours in ink?",
    assignments:
      "1. Draw labelled diagrams of (a) filtration apparatus, (b) simple distillation apparatus.\n2. Explain the principle behind chromatography and give two uses.\n3. At home, perform a simple evaporation experiment using salt water and report your observations.",
    references:
      "1. Ababio, O. Y. (2019). New School Chemistry for Senior Secondary Schools. Africana-FIRST Publishers.\n2. Federal Ministry of Education (2012). Senior Secondary Chemistry Curriculum. NERDC.",
  },

  // ── SS 2 ───────────────────────────────────────────────────────────────────
  {
    title: "SS 2 Mathematics – Logarithms",
    level: "ss",
    className: "SS 2",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 1,
    topic: "Logarithms: Introduction, Laws, and Applications",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define logarithm and relate it to indices.\n2. Convert between index form and logarithmic form.\n3. Apply the three laws of logarithms.\n4. Use logarithm tables to evaluate expressions.",
    entryBehaviour:
      "Students should be able to work with indices and know their laws from SS 1.",
    instructionalMaterials:
      "Four-figure table (log tables), whiteboard and markers, worked examples chart.",
    content:
      "LOGARITHMS\nIf a^x = N, then x = logₐN.\nIn words: The logarithm of N to base a is x — meaning a raised to the power x equals N.\n\nExample: 2³ = 8, so log₂8 = 3.\n\nCOMMON LOGARITHM (Base 10)\nlog₁₀N is written as log N (no base written means base 10).\nExample: log 1000 = log 10³ = 3.\n\nLAWS OF LOGARITHMS\n1. Product Rule: log(MN) = log M + log N\n   Example: log(4 × 5) = log 4 + log 5\n\n2. Quotient Rule: log(M/N) = log M − log N\n   Example: log(20/4) = log 20 − log 4\n\n3. Power Rule: log(Mⁿ) = n × log M\n   Example: log(5³) = 3 × log 5\n\nSPECIAL VALUES\nlog 1 = 0 (because 10⁰ = 1)\nlog 10 = 1 (because 10¹ = 10)\nlog 100 = 2 (because 10² = 100)\n\nUSING LOG TABLES\nStep 1: Write the number in standard form (N × 10ⁿ).\nStep 2: Find the mantissa from the log table.\nStep 3: Add the characteristic (n, the power of 10).\nExample: log 34.56 = 1.5385 (characteristic 1, mantissa from table).",
    teacherActivities:
      "Step 1 (5 min): Recall indices. Ask: '2 raised to what power gives 8?' Introduce log notation.\nStep 2 (10 min): Convert between index and log forms. Establish special log values.\nStep 3 (15 min): Derive and explain the three laws. Solve examples for each law.\nStep 4 (7 min): Show students how to use log tables step by step.\nStep 5 (3 min): Summarise and give evaluation questions.",
    studentActivities:
      "• Recall index laws.\n• Convert between index and log forms.\n• Apply log laws to solve problems.\n• Use log tables under teacher guidance.",
    evaluationQuestions:
      "1. Convert to log form: (a) 3⁴ = 81 (b) 10² = 100\n2. Convert to index form: (a) log₂32 = 5 (b) log₁₀1000 = 3\n3. Simplify: log 6 + log 5\n4. Simplify: log 36 − log 4\n5. Use log tables to find: log 456.8",
    assignments:
      "1. Evaluate using log laws: (a) log 2 + log 50 (b) log 125 ÷ log 5 (c) 3 log 4\n2. Use log tables to evaluate: (a) 34.5 × 12.7 (b) 456 ÷ 23.4\n3. Show that log(1/N) = −log N.",
    references:
      "1. Adelodun, A. O. (2019). New General Mathematics for SS2. Longman.\n2. Channon, J. B. et al. (2017). New General Mathematics for West Africa SS2. Longman.",
  },
  {
    title: "SS 2 Biology – Nutrition in Plants",
    level: "ss",
    className: "SS 2",
    subjectName: "Biology",
    term: "first",
    weekNumber: 1,
    topic: "Nutrition in Plants: Photosynthesis",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define photosynthesis and state its importance.\n2. Write the chemical equation for photosynthesis.\n3. Describe the role of the leaf in photosynthesis.\n4. State the factors that affect the rate of photosynthesis.\n5. Explain how to test a leaf for starch.",
    entryBehaviour:
      "Students should know that plants make their own food and that they need sunlight, water, and carbon dioxide.",
    instructionalMaterials:
      "Fresh leaves (e.g., mango or pawpaw), ethanol, iodine solution, water bath, petri dish, Biology textbook (SS 2), diagram of leaf cross-section, whiteboard.",
    content:
      "PHOTOSYNTHESIS\nPhotosynthesis is the process by which green plants manufacture their own food (glucose) from carbon dioxide and water using light energy, with oxygen released as a by-product.\n\nCHEMICAL EQUATION:\n6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂\n(Carbon dioxide + Water → Glucose + Oxygen)\n\nThis reaction requires chlorophyll and light energy.\n\nSITE OF PHOTOSYNTHESIS\nPhotosynthesis occurs mainly in the leaves (mesophyll cells), specifically in the chloroplasts which contain chlorophyll — the green pigment that absorbs light energy.\n\nSTRUCTURAL ADAPTATIONS OF THE LEAF\n• Broad, flat surface: Maximises light absorption.\n• Thin: Allows CO₂ to diffuse quickly.\n• Transparent cuticle: Allows light to pass through.\n• Stomata: Tiny pores that allow gas exchange.\n• Veins (vascular bundles): Transport water (xylem) and food (phloem).\n\nFACTORS AFFECTING PHOTOSYNTHESIS\n1. Light intensity: More light → faster photosynthesis.\n2. CO₂ concentration: More CO₂ → faster photosynthesis.\n3. Temperature: Optimum ~25–35°C; enzymes denature above 40°C.\n4. Water availability: Less water → slower rate.\n5. Chlorophyll amount: More chlorophyll → more photosynthesis.\n\nTESTING FOR STARCH IN A LEAF\n1. Destarch the plant (keep in dark for 48 hours).\n2. Remove a leaf and dip in boiling water (to kill cells).\n3. Place in ethanol (heated in water bath) to remove chlorophyll.\n4. Rinse with warm water.\n5. Add iodine solution: Blue-black colour = starch present.",
    teacherActivities:
      "Step 1 (5 min): Ask: 'Where does the food plants eat come from?' Lead into photosynthesis.\nStep 2 (8 min): Define photosynthesis and write the chemical equation on the board.\nStep 3 (12 min): Explain the leaf structure and its adaptations using the diagram.\nStep 4 (10 min): Discuss factors affecting photosynthesis with examples.\nStep 5 (5 min): Walk through the starch test procedure. Evaluate and summarise.",
    studentActivities:
      "• Suggest how plants get food.\n• Copy the equation for photosynthesis.\n• Study the leaf cross-section diagram.\n• Listen to factor explanations and take notes.\n• Follow the starch test steps and write them in their books.",
    evaluationQuestions:
      "1. Define photosynthesis. Write the word equation and chemical equation.\n2. Where exactly does photosynthesis take place in a leaf?\n3. State FOUR factors that affect the rate of photosynthesis.\n4. Describe the procedure for testing a leaf for starch.",
    assignments:
      "1. Draw and label a cross-section of a leaf, showing all structures involved in photosynthesis.\n2. Explain why a variegated leaf (green and white sections) only shows starch in the green parts after the starch test.\n3. Describe TWO ways in which photosynthesis is important to all living organisms, not just plants.",
    references:
      "1. Ifeoma Okafor (2020). Biology for Senior Secondary Schools Book 2. University Press.\n2. Federal Ministry of Education (2012). Senior Secondary Biology Curriculum. NERDC.",
  },

  // ── Primary ────────────────────────────────────────────────────────────────
  {
    title: "Primary 4 Mathematics – Numbers to 10,000",
    level: "primary",
    className: "Primary 4",
    subjectName: "Mathematics",
    term: "first",
    weekNumber: 1,
    topic: "Counting and Writing Numbers to 10,000",
    duration: "35 minutes",
    objectives:
      "By the end of this lesson, pupils should be able to:\n1. Count from 1 to 10,000.\n2. Write numbers from 1 to 10,000 in figures and in words.\n3. Identify the place value of each digit in a 4-digit number.\n4. Compare and order 4-digit numbers.",
    entryBehaviour:
      "Pupils should be able to count, read, and write numbers up to 1,000.",
    instructionalMaterials:
      "Number chart (1–10,000), abacus, number cards, place value chart, whiteboard.",
    content:
      "COUNTING TO 10,000\nWe already know how to count to 1,000. Let us now extend this to 10,000.\n\nAfter 999 comes 1,000 (one thousand).\nAfter 9,999 comes 10,000 (ten thousand).\n\nPLACE VALUE IN 4-DIGIT NUMBERS\n| Thousands | Hundreds | Tens | Ones |\n|-----------|----------|------|------|\n| 1,000     | 100      | 10   | 1    |\n\nExample: In the number 5,678:\n• 5 is in the thousands place (5,000)\n• 6 is in the hundreds place (600)\n• 7 is in the tens place (70)\n• 8 is in the ones place (8)\n\nSo 5,678 = 5,000 + 600 + 70 + 8\n\nWRITING IN WORDS:\n5,678 = Five thousand, six hundred and seventy-eight.\n\nCOMPARING NUMBERS:\n8,430 > 8,034 (look at the hundreds: 4 > 0, so 8,430 is greater)",
    teacherActivities:
      "Step 1 (5 min): Count from 990 to 1,010 with students. Show on the number chart.\nStep 2 (10 min): Use the abacus to show place value of 4-digit numbers.\nStep 3 (10 min): Write examples on the board. Show expanded form and writing in words.\nStep 4 (7 min): Compare pairs of numbers. Ask students which is larger and why.\nStep 5 (3 min): Summarise and ask evaluation questions.",
    studentActivities:
      "• Count aloud from 990 to 1,010.\n• Observe the abacus demonstration.\n• Write numbers in expanded form and in words.\n• Compare pairs of numbers using > and <.",
    evaluationQuestions:
      "1. Write in words: (a) 3,456 (b) 7,009\n2. What is the place value of 8 in 8,357?\n3. Write in figures: Seven thousand, two hundred and fourteen.\n4. Which is greater: 4,509 or 4,590?",
    assignments:
      "1. Write the following in words: (a) 2,700 (b) 5,060 (c) 9,999.\n2. Write the expanded form of: 6,842.\n3. Arrange in order from smallest to largest: 2,345; 2,543; 2,435; 2,354.",
    references:
      "1. Onu, A. et al. (2020). Nigeria Primary Mathematics Book 4. University Press.\n2. Federal Ministry of Education (2012). Primary Mathematics Curriculum. NERDC.",
  },
  {
    title: "Primary 5 English Studies – Reading Comprehension",
    level: "primary",
    className: "Primary 5",
    subjectName: "English Studies",
    term: "first",
    weekNumber: 1,
    topic: "Reading Comprehension: Identifying the Main Idea",
    duration: "35 minutes",
    objectives:
      "By the end of this lesson, pupils should be able to:\n1. Read a passage with understanding.\n2. Identify the main idea of a passage.\n3. Answer questions based on the passage.\n4. Use context clues to understand unfamiliar words.",
    entryBehaviour:
      "Pupils should be able to read a short paragraph and identify characters or events in a story.",
    instructionalMaterials:
      "Comprehension passage printed on cards (or written on the board), English textbook (Primary 5), dictionary, whiteboard.",
    content:
      "READING COMPREHENSION\nComprehension means understanding what you read. When we read a passage, we try to understand:\n1. What is the passage about? (Main idea)\n2. What are the details? (Supporting ideas)\n3. What do new words mean? (Vocabulary)\n\nTHE MAIN IDEA\nThe main idea is the most important thought in a passage. It is what the whole passage is about. It is usually found in the first or last sentence of a paragraph (the topic sentence).\n\nSAMPLE PASSAGE:\n'Water is very important for life. Every living thing — plants, animals, and humans — needs water to survive. Our bodies are made up of about 60% water. We use water for drinking, cooking, farming, and keeping ourselves clean. Without water, life on Earth would be impossible.'\n\nMain Idea: Water is essential for all life.\nSupporting Details: Bodies are 60% water; we use water for drinking, cooking, farming, and cleaning.\n\nCONTEXT CLUES\nWhen you see an unfamiliar word, look at the surrounding words (context) to guess its meaning.\nExample: 'The arid desert had no water for miles.' The words 'no water' help you understand that 'arid' means dry.",
    teacherActivities:
      "Step 1 (5 min): Ask pupils: 'What do you do when you don't understand a word while reading?'\nStep 2 (8 min): Explain what comprehension means. Discuss main idea vs supporting details.\nStep 3 (12 min): Read the sample passage aloud. Then read it together as a class.\nStep 4 (8 min): Ask questions about the passage. Guide pupils to find answers in the text.\nStep 5 (2 min): Summarise strategies for understanding a passage.",
    studentActivities:
      "• Share strategies for understanding difficult words.\n• Listen to and read the passage.\n• Identify the main idea of the passage.\n• Answer comprehension questions.\n• Use context clues to define 'arid'.",
    evaluationQuestions:
      "1. What is the main idea of the passage about water?\n2. Why is water important for human beings? Give two reasons from the passage.\n3. What percentage of our body is water?\n4. What does the word 'impossible' mean? Use it in a sentence.",
    assignments:
      "1. Read the passage on page 14 of your textbook. Write the main idea in one sentence.\n2. Write three supporting details from the same passage.\n3. Find five new words in any passage you have read this week. Write their meanings.",
    references:
      "1. Adeniyi, O. et al. (2020). Leading English Course for Primary Schools Book 5. University Press.\n2. Federal Ministry of Education (2012). Primary English Curriculum. NERDC.",
  },
  {
    title: "JSS 3 English Language – Essay Writing",
    level: "jss",
    className: "JSS 3",
    subjectName: "English Language",
    term: "first",
    weekNumber: 1,
    topic: "Essay Writing: Types of Essays and Structure",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define an essay and explain its purpose.\n2. Identify and describe four types of essays.\n3. Outline the three-part structure of a well-written essay.\n4. Write a topic sentence and supporting sentences for a paragraph.",
    entryBehaviour:
      "Students should be able to write a paragraph with a topic sentence and supporting sentences.",
    instructionalMaterials:
      "Sample essays (narrative, expository, argumentative, descriptive), essay structure chart, whiteboard and markers, textbook.",
    content:
      "WHAT IS AN ESSAY?\nAn essay is a piece of formal writing on a specific topic. It presents ideas clearly, logically, and persuasively.\n\nTYPES OF ESSAYS\n1. Narrative Essay: Tells a story from a personal perspective. Has characters, setting, plot.\n   Key phrase: 'Write a story about...'\n\n2. Descriptive Essay: Describes a person, place, thing, or experience in detail.\n   Key phrase: 'Describe your...'\n\n3. Expository Essay: Explains or informs about a topic without bias.\n   Key phrase: 'Explain how/why...' or 'Write about the causes of...'\n\n4. Argumentative/Persuasive Essay: Presents arguments for or against a position.\n   Key phrase: 'Discuss the advantages/disadvantages...' or 'Write for or against...'\n\nESSAY STRUCTURE\nEvery essay has three parts:\n\n1. INTRODUCTION\n• Grabs the reader's attention.\n• Introduces the topic.\n• States the thesis (main point).\nLength: 1 paragraph.\n\n2. BODY\n• Contains the main ideas, arguments, or events.\n• Each paragraph covers ONE main point.\n• Each paragraph: topic sentence + supporting sentences + concluding sentence.\nLength: 2–5 paragraphs.\n\n3. CONCLUSION\n• Summarises the main points.\n• Restates the thesis in different words.\n• Ends with a strong closing statement.\nLength: 1 paragraph.",
    teacherActivities:
      "Step 1 (5 min): Ask: 'What is the difference between a letter and an essay?'\nStep 2 (10 min): Define essay and explain the four types with examples from past WAEC questions.\nStep 3 (12 min): Explain the three-part structure with a model essay on the board.\nStep 4 (8 min): Ask students to identify the introduction, body, and conclusion in a sample essay.\nStep 5 (5 min): Guide students in writing a topic sentence for a given essay topic. Evaluate.",
    studentActivities:
      "• Distinguish between letters and essays.\n• Copy definitions of essay types.\n• Identify introduction, body, and conclusion in the sample essay.\n• Write a topic sentence for an assigned topic.",
    evaluationQuestions:
      "1. What is an essay? State four types of essays.\n2. What are the three main parts of every essay?\n3. What is a thesis statement?\n4. Write a suitable topic sentence for this essay: 'The importance of education in Nigeria.'",
    assignments:
      "1. Write a well-structured essay (150–200 words) on the topic: 'My Most Memorable Day'.\n2. Read a sample essay in your textbook. Identify: (a) the type of essay, (b) the thesis statement, (c) the topic sentence of each body paragraph.",
    references:
      "1. Idowu, P. et al. (2021). New Oxford Secondary English Book 3. Oxford University Press.\n2. Oluikpe, B. O. A. (2018). Comprehensive English for JSS 3. Africana-FIRST Publishers.\n3. Federal Ministry of Education (2012). Junior Secondary English Curriculum. NERDC.",
  },
  {
    title: "SS 2 Economics – Supply and Demand",
    level: "ss",
    className: "SS 2",
    subjectName: "Economics",
    term: "first",
    weekNumber: 1,
    topic: "Demand: Definition, Law of Demand, and Demand Schedule",
    duration: "40 minutes",
    objectives:
      "By the end of this lesson, students should be able to:\n1. Define demand and distinguish it from want or need.\n2. State and explain the Law of Demand.\n3. Draw a demand schedule and a demand curve.\n4. Identify factors that cause a shift in the demand curve.",
    entryBehaviour:
      "Students should know the basic economic concepts of scarcity, choice, and price from SS 1.",
    instructionalMaterials:
      "Graph paper, ruler, Economics textbook (SS 2), chart showing demand curve, whiteboard.",
    content:
      "WHAT IS DEMAND?\nDemand is the quantity of a good or service that consumers are willing and able to buy at a given price, during a given time period.\nImportant: Demand requires BOTH willingness AND ability (purchasing power) to buy.\n\nLAW OF DEMAND\nThe Law of Demand states that, all other things being equal (ceteris paribus), as the price of a good increases, the quantity demanded decreases; and as the price decreases, the quantity demanded increases.\nIn short: Price and quantity demanded have an INVERSE relationship.\n\nDEMAND SCHEDULE\nA demand schedule is a table showing the quantity of a good demanded at different price levels.\n\nExample: Demand for rice (per kg) per month:\n| Price (₦) | Quantity Demanded (kg) |\n|-----------|------------------------|\n| 100       | 50                     |\n| 200       | 40                     |\n| 300       | 30                     |\n| 400       | 20                     |\n| 500       | 10                     |\n\nDEMAND CURVE\nPlot Price on Y-axis and Quantity on X-axis. The demand curve slopes downward from left to right (negative slope) — showing the inverse relationship.\n\nSHIFTS IN DEMAND CURVE\nThe demand curve SHIFTS (not slides) when non-price factors change:\n1. Income: Higher income → more demand (shifts right).\n2. Tastes and preferences: Fashion increases → demand increases.\n3. Price of related goods: If price of bread rises, demand for yam rises (substitute).\n4. Population: More people → more demand.\n5. Expectations: If prices expected to rise, current demand increases.",
    teacherActivities:
      "Step 1 (5 min): Ask: 'Would you buy more or less bread if its price doubles?' Use this to introduce the Law of Demand.\nStep 2 (10 min): Define demand. Differentiate demand from want. State and explain the Law of Demand.\nStep 3 (12 min): Present the demand schedule. Plot the demand curve step-by-step on the board.\nStep 4 (8 min): Explain shifts in the demand curve with examples.\nStep 5 (5 min): Evaluate and summarise.",
    studentActivities:
      "• Respond to the opening question.\n• Copy the definition and Law of Demand.\n• Plot the demand curve using the schedule.\n• Identify which factor would cause a demand shift in given scenarios.",
    evaluationQuestions:
      "1. Define demand. How is it different from want?\n2. State the Law of Demand and explain it with an example.\n3. Using the demand schedule above, draw a demand curve.\n4. State THREE factors that cause a shift in the demand curve.",
    assignments:
      "1. Construct a demand schedule for yam with five different prices and plot the demand curve.\n2. Explain with examples how 'income' and 'population' affect demand.\n3. What does it mean when the demand curve shifts to the right vs to the left?",
    references:
      "1. Anyaele, J. U. (2019). Comprehensive Economics for SS2. Johnson Publishers.\n2. Lipsey, R. G. & Crystal, A. K. (2015). Economics (13th ed.). Oxford University Press.",
  },
];

export async function seedLessonNoteTemplates(): Promise<void> {
  try {
    let added = 0;
    let skipped = 0;

    for (const tpl of TEMPLATES) {
      try {
        // Check if template already exists (by unique key)
        const existing = await db
          .select()
          .from(lessonNoteTemplates)
          .where(
            and(
              eq(lessonNoteTemplates.className, tpl.className),
              eq(lessonNoteTemplates.subjectName, tpl.subjectName),
              eq(lessonNoteTemplates.term, tpl.term),
              eq(lessonNoteTemplates.weekNumber, tpl.weekNumber),
              eq(lessonNoteTemplates.topic, tpl.topic)
            )
          );

        if (existing.length > 0) {
          if (!existing[0].isPublished) {
            await db
              .update(lessonNoteTemplates)
              .set({ isPublished: true, updatedAt: new Date() })
              .where(eq(lessonNoteTemplates.id, existing[0].id));
          }
          skipped++;
          continue;
        }

        await db.insert(lessonNoteTemplates).values({
          ...tpl,
          isPublished: true,
          createdBy: null,
        });
        added++;
      } catch (err: any) {
        if (err?.code === "23505") {
          skipped++;
        } else {
          console.error(`[LessonNoteLibrary] Error inserting template "${tpl.title}":`, err?.message);
        }
      }
    }

    if (added > 0 || skipped > 0) {
      console.log(`📚 Lesson Note Library: ${added} templates added, ${skipped} already exist.`);
    }
  } catch (err) {
    console.error("[LessonNoteLibrary] Seed failed:", err);
  }
}
