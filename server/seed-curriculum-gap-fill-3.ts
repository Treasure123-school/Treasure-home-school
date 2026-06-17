/**
 * Nigerian Curriculum Gap-Fill Seed — Part 3
 *
 * Adds the remaining Senior Secondary (SS1–SS3) language and religious studies subjects:
 *   Yoruba, Igbo, Hausa, Islamic Studies (IRS)
 *
 * Sources: scholarclopedia.com/ng, syllabus.ng
 * Deduplicates by (className, subjectName) — never overwrites existing data.
 * All templates are published=true so admins can immediately edit or adjust them.
 */

import { db } from "./storage";
import { curriculumTemplates, curriculumTemplateTopics } from "@shared/schema.pg";

interface TopicDef {
  term: "first" | "second" | "third";
  week: number;
  name: string;
  description?: string;
}

interface TemplateDef {
  title: string;
  level: "primary" | "jss" | "ss" | "custom";
  className: string;
  subjectName: string;
  description: string;
  topics: TopicDef[];
}

function terms(t1: string[], t2: string[], t3: string[]): TopicDef[] {
  const out: TopicDef[] = [];
  t1.forEach((n, i) => out.push({ term: "first",  week: i + 1, name: n }));
  t2.forEach((n, i) => out.push({ term: "second", week: i + 1, name: n }));
  t3.forEach((n, i) => out.push({ term: "third",  week: i + 1, name: n }));
  return out;
}

const T: TemplateDef[] = [

  // ═══════════════════════════════════════════════════════════════════════
  //  YORUBA — SS 1, SS 2, SS 3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "SS 1 – Yoruba",
    level: "ss", className: "SS 1", subjectName: "Yoruba",
    description: "Yoruba Language and Literature for SS 1 covering grammar, oral literature, cultural studies and composition.",
    topics: terms(
      [
        "Ọrọ Orúkọ (Nouns): Types and Uses in Yoruba",
        "Ọrọ Apẹ̀yẹ̀ (Adjectives) and Ọrọ Àfikún (Adverbs)",
        "Ohùn Yorùbá (Tones): High, Mid and Low Tone Rules",
        "Àló Àpagbè (Riddles): Features and Cultural Significance",
        "Ọ̀wẹ̀ (Proverbs): 40 Proverbs – Meanings and Application",
        "Ifá Divination Literature: Introduction and Structure",
        "Rárà (Dirge Poetry): Features, Types and Performance",
        "Sàngó Pípè (Praise Poetry): Introduction and Examples",
        "Kíkàwe àti Àkópọ̀ (Comprehension and Summary Writing)",
        "Kíkọ Àrokọ (Composition): Narrative Essay in Yoruba",
        "Kíkọ Lẹ́tà (Letter Writing): Informal and Formal in Yoruba",
        "Àtúnyẹ̀wò àti Ìdánwò (Revision and Examination)",
      ],
      [
        "Ẹ̀kọ́ Gírámà: Ọrọ Ìṣe (Verbs) – Types and Conjugation",
        "Ọ̀rọ̀ Àsopọ̀ (Conjunctions) and Ìpèdè (Prepositions)",
        "Ìjálá (Hunter's Poetry): Features and Oral Performance",
        "Òrìkì (Praise Chants): Types, Themes and Significance",
        "Àtúpale Egbé (Drama): Structure, Types and Features",
        "Àwọn Ìwé Ìtàn Yorùbá (Yoruba Literary Texts): Study of Prescribed Text",
        "Àrokọ Àpẹ̀yẹ̀ (Descriptive Composition) in Yoruba",
        "Ìwé Ìròyìn (Report Writing) in Yoruba",
        "Àṣà àti Ìṣẹ̀dálẹ̀ Yorùbá (Yoruba Culture and Civilization)",
        "Ìtúmọ̀ (Translation): English to Yoruba",
        "Ọ̀rọ̀-Àsọ̀mọ (Idiomatic Expressions) and Vocabulary",
        "Àtúnyẹ̀wò àti Ìdánwò (Revision and Examination)",
      ],
      [
        "Ọ̀rọ̀ Àríyanjiyàn (Oral Debate) and Discussion in Yoruba",
        "Drama Text: In-depth Reading and Character Analysis",
        "Ewì (Poetry): Appreciation and Critical Analysis",
        "Àrokọ Àríyànjiyàn (Argumentative Essay) in Yoruba",
        "Àkópọ̀ (Summary Writing): Techniques and Practice",
        "Àtúnyẹ̀wò: Gírámà àti Àrokọ (Grammar and Composition Revision)",
        "Àtúnyẹ̀wò: Ìtàn àti Ọ̀rọ̀ Èdè (Literature and Oral Revision)",
        "Ìdánwò Ìparí (Final Examination)",
      ]
    ),
  },

  {
    title: "SS 2 – Yoruba",
    level: "ss", className: "SS 2", subjectName: "Yoruba",
    description: "Yoruba Language and Literature for SS 2 with advanced grammar, literary appreciation and WAEC preparation.",
    topics: terms(
      [
        "Gírámà Gíga (Advanced Grammar): Complex Sentence Structures",
        "Ọrọ Atọ́kasí (Pronouns): Advanced Usage and Agreement",
        "Ìjálá: Advanced Analysis and Contextual Interpretation",
        "Ewì (Poetry): Types, Themes and WAEC Text Analysis",
        "Àló Àpagbè: Critical Appreciation and Structure",
        "Ìwé Ìtàn (Prescribed Prose Text): Character and Theme Study",
        "Àrokọ Àlàyé (Expository Writing) in Yoruba",
        "Àṣà Yorùbá: Orí, Ìwà àti Ìgbàgbọ́ (Beliefs and Values)",
        "Yorùbá ní Àgbáyé Òde Òní (Yoruba in the Modern World)",
        "Ìtúmọ̀ (Translation): Yoruba to English",
        "Kíkàwe Gíga (Advanced Comprehension Passages)",
        "Àtúnyẹ̀wò àti Ìdánwò (Revision and Examination)",
      ],
      [
        "Fóònẹ́tíìkì Yorùbá (Phonology): Tonal Assimilation and Elision",
        "Ifá Corpus: Selected Verses and Interpretation",
        "Rárà: Performance, Structure and Thematic Study",
        "Sàngó Pípè: Advanced Features and Literary Value",
        "Egbé Ìjáká (Drama): Staging, Theme and Production",
        "Àtúnyẹ̀wò Ìtàn Ẹnu (Oral Literature): All Forms",
        "Lẹ́tà Ìṣẹ́ (Official/Formal Letter Writing)",
        "Ìròyìn Gíga (Advanced Report Writing)",
        "Ẹ̀kọ́ Ọjọ́ Yorùbá (Yoruba Calendar) and Number System",
        "Àwọn Àsè àti Ìsìn Yorùbá (Festivals and Religious Practices)",
        "Ọ̀rọ̀ Ìjìnlẹ̀ (Technical Vocabulary): Terms and Usage",
        "Àtúnyẹ̀wò àti Ìdánwò (Revision and Examination)",
      ],
      [
        "Ìgbéléwọ̀n WAEC/NECO Yorùbá: Format of Papers 1, 2 and 3",
        "Àwọn Ìbéèrè Àkọsílẹ̀ (Past Questions Practice): Oral Literature",
        "Àtúnyẹ̀wò Gírámà (Grammar Revision): Key Topics",
        "Àtúnyẹ̀wò Ìtàn (Literature Revision): Prescribed Texts",
        "Àtúnyẹ̀wò Àrokọ (Composition Revision): All Essay Types",
        "Ìtàn Ẹnu (Oral Yoruba Revision): Performance Skills",
        "Ìdánwò Ìdánwò (Mock Examination): Full Paper",
        "Ìmúrasílẹ̀ Ìparí (Final Preparation and Review)",
      ]
    ),
  },

  {
    title: "SS 3 – Yoruba",
    level: "ss", className: "SS 3", subjectName: "Yoruba",
    description: "Yoruba Language and Literature for SS 3 with comprehensive WAEC/NECO revision across all areas.",
    topics: terms(
      [
        "Àtúnyẹ̀wò Gbogbogbò: Gírámà (Comprehensive Grammar Review)",
        "Àtúnyẹ̀wò: Ìtàn Ẹnu (Oral Literature Complete Review)",
        "Àtúnyẹ̀wò: Àwọn Ìwé Ìtàn (Written Literature Texts Review)",
        "Àtúnyẹ̀wò: Àrokọ (Composition – All Types Review)",
        "Ìtúmọ̀ Ìdánwò (Translation Practice): Both Directions",
        "Ọ̀rọ̀ Ìjìnlẹ̀ (Vocabulary Mastery) and Idioms",
        "Fóònẹ́tíìkì (Phonology): Final Review and Problem Areas",
        "Àṣà Yorùbá (Culture): Complete Revision for Examination",
        "WAEC Yorùbá: Ìpèsè Ìwé Àkọ̀sílẹ̀ 1 (Paper 1 – Objectives Format)",
        "WAEC Yorùbá: Ìpèsè Ìwé Àkọ̀sílẹ̀ 2 (Paper 2 – Essay/Theory)",
        "Ìdánwò Ẹnu Yorùbá (Oral Yoruba Test): Preparation",
        "Àtúnyẹ̀wò àti Ìdánwò (Revision and Examination)",
      ],
      [
        "WAEC Yorùbá: Àwọn Ìbéèrè Àkọsílẹ̀ – Ìtàn Ẹnu (Oral Literature Past Questions)",
        "WAEC Yorùbá: Àwọn Ìbéèrè Àkọsílẹ̀ – Gírámà (Grammar Past Questions)",
        "WAEC Yorùbá: Àwọn Ìbéèrè Àkọsílẹ̀ – Kíkàwe (Comprehension Past Questions)",
        "WAEC Yorùbá: Àwọn Ìbéèrè Àkọsílẹ̀ – Àrokọ (Composition Past Questions)",
        "Ìdánwò Ìdánwò Gbogbo (Full Mock Examination)",
        "Àwọn Àṣìṣe Tó Ìgbàgbogbo (Common Errors in WAEC Yoruba)",
        "Àṣà Kíkọ Ìdánwò (Speed Writing Practice for Examinations)",
        "Ìmúrasílẹ̀ Ìdánwò Ẹnu (Oral Interview Preparation)",
        "Ìjìnlẹ̀ Àtúnyẹ̀wò: Ìtàn (Intensive Revision – Literature)",
        "Ìjìnlẹ̀ Àtúnyẹ̀wò: Gírámà (Intensive Revision – Grammar)",
        "Ìdánwò Ìkẹyìn (Final Mock Examination and Review)",
        "Ìmúrasílẹ̀ Ìparí WAEC (Final WAEC Preparation)",
      ],
      [
        "Ìparí Àtúnyẹ̀wò: Ìtàn Ẹnu (Final Oral Literature Revision)",
        "Ìparí Àtúnyẹ̀wò: Gírámà (Final Grammar Revision)",
        "Ìparí Àrokọ (Final Composition Practice)",
        "Ìdánwò Àdánwò WAEC (WAEC Mock Paper)",
        "Ìmúrasílẹ̀ Ìparí (Final Examination Preparation)",
        "Àtúnyẹ̀wò Àárọ̀ (Last Revision Session)",
        "Ìdánwò Ìparí (Final Examination)",
      ]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  IGBO — SS 1, SS 2, SS 3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "SS 1 – Igbo",
    level: "ss", className: "SS 1", subjectName: "Igbo",
    description: "Igbo Language and Literature for SS 1 covering grammar, oral literature, Omenala and composition.",
    topics: terms(
      [
        "Ụdaolu Igbo (Phonology): Igbo Tonal System and Vowel Harmony",
        "Ọrụ Nnọchie Aha (Pronouns): Types and Advanced Usage",
        "Ogugu na Nkọwa (Comprehension): Reading and Interpretation",
        "Akụkọ Ifo (Folktales): Structure, Features and Cultural Value",
        "Ilu Igbo (Proverbs): 40 Proverbs – Meanings and Usage",
        "Ọtụtụ Igbo (Oral Literature): Types and Characteristics",
        "Ederede Igbo – Akụkọ (Composition): Narrative Writing",
        "Ederede – Echiche na Kọwa (Expository Writing) in Igbo",
        "Akụkọ Ihe Odide (Prescribed Story Text): Reading and Analysis",
        "Omenala Igbo (Igbo Culture): Introduction and Key Practices",
        "Akwụkwọ Ozi (Letter Writing) in Igbo",
        "Nchịkọta na Ọlụlụ (Revision and Examination)",
      ],
      [
        "Usoro Asụsụ Igbo (Grammar): Complex Sentence Structures",
        "Njikọ Ahịa (Conjunctions) and Ọrụ Ha (Their Uses)",
        "Egwu na Ihe Nkiri (Music and Drama) in Igbo Oral Tradition",
        "Nkọwa Ihe Odide (Poem Analysis): Features and Themes",
        "Oge Ọ Bụrụ (Tenses in Igbo): Usage and Practice",
        "Akụkọ Ụdị Ọzọ (Other Narrative Forms): Myths and Legends",
        "Ọchọchọ Ihe na Ịkọ Akụkọ (Research and Reporting)",
        "Asụsụ Igbo n'onuohia na Ọchịchọ (Igbo in Media)",
        "Omenala: Ọlụchị na Ịlụ Di na Nwunye (Marriage Customs)",
        "Ntụgharị Asụsụ (Translation): English to Igbo",
        "Ọkọlọtọ Asụsụ (Vocabulary): Technical Terms and Idioms",
        "Nchịkọta na Ọlụlụ (Revision and Examination)",
      ],
      [
        "Ikwu Ọnụ Igbo (Oral Igbo): Debate and Public Discussion",
        "Ihe Nkiri (Drama Text): Reading and Character Analysis",
        "Ihe Odide (Poetry): Appreciation and Critical Analysis",
        "Ederede Isi Ọchọchọ (Argumentative Essay) in Igbo",
        "Nchịkọta Ihe Ọgụgụ (Summary Writing): Techniques",
        "Nchịkọta: Usoro Asụsụ na Ederede (Grammar and Composition)",
        "Nchịkọta: Ọtụtụ na Omenala (Literature and Culture)",
        "Ọlụlụ Ọha (Final Examination)",
      ]
    ),
  },

  {
    title: "SS 2 – Igbo",
    level: "ss", className: "SS 2", subjectName: "Igbo",
    description: "Igbo Language and Literature for SS 2 with advanced literary appreciation and WAEC format introduction.",
    topics: terms(
      [
        "Usoro Asụsụ Igbo Dị Elu (Advanced Igbo Grammar)",
        "Ilu Igbo: Ilu 60 na Akpọrọ Ha (60 Proverbs and Their Applications)",
        "Akụkọ Ifo: Nkọwa Nke Ọzọ (Folktales: Critical Appreciation)",
        "Ihe Odide Igbo (Igbo Poetry): Advanced Analysis and Forms",
        "Ihe Nkiri (Drama): Structural Analysis and Stagecraft",
        "Akwụkwọ Ọgụgụ (Prescribed Literature Text): Theme and Style",
        "Ọtụtụ Igbo Dị Elu (Advanced Oral Techniques)",
        "Omenala: Mmemme na Ọchịchọ (Festivals and Ceremonies)",
        "Ederede Kọwa Ihe (Descriptive Composition) in Igbo",
        "Igbo n'Naịjirịa Ọ Dị Ugbu a (Igbo in Contemporary Nigeria)",
        "Ntụgharị Asụsụ Dị Elu (Advanced Translation Practice)",
        "Nchịkọta na Ọlụlụ (Revision and Examination)",
      ],
      [
        "Ụdaolu Igbo Dị Elu (Advanced Phonology): Tone Patterns",
        "Ọtụtụ Igbo: Nkọwa Zuru Ezu (Complete Oral Literature Appreciation)",
        "Akwụkwọ Ọgụgụ (Prose Texts): Critical and Contextual Analysis",
        "Ihe Odide: Ụdị Nile (All Forms of Poetry): Advanced Study",
        "Ihe Nkiri n'ọchịchọ Igbo (Igbo Theatre): Staging and Production",
        "Akwụkwọ Ozi Ọbịbịa (Formal Reports) in Igbo",
        "Akwụkwọ Ozi Ọrụ (Official Letter Writing) in Igbo",
        "Ọgụgụ Igbo na Ụlọ Akwụkwọ (Igbo Calendar) and Number Systems",
        "Ihe Nketa Omenala Igbo (Igbo Cultural Heritage) and Identity",
        "Ọkọlọtọ Asụsụ (Vocabulary Development): Advanced Terms",
        "Mmeghe WAEC (WAEC Format Introduction) for Igbo Language",
        "Nchịkọta na Ọlụlụ (Revision and Examination)",
      ],
      [
        "Ọlụlụ WAEC/NECO Igbo: Usoro Ọlụlụ (Paper Format)",
        "Ajụjụ Gara Aga – Ọtụtụ (Past Questions: Oral Literature)",
        "Nchịkọta: Usoro Asụsụ (Grammar Revision)",
        "Nchịkọta: Ọtụtụ na Ihe Nkiri (Literature Revision)",
        "Nchịkọta: Ederede (Composition Revision)",
        "Nchịkọta: Ikwu Ọnụ Igbo (Oral Igbo Revision)",
        "Ọlụlụ Nnwale (Mock Examination – Full Paper)",
        "Mkparịta Ụka Nke Ikpeazụ (Final Preparation)",
      ]
    ),
  },

  {
    title: "SS 3 – Igbo",
    level: "ss", className: "SS 3", subjectName: "Igbo",
    description: "Igbo Language and Literature for SS 3 with comprehensive WAEC/NECO revision and examination preparation.",
    topics: terms(
      [
        "Nchịkọta Zuru Ezu: Usoro Asụsụ (Comprehensive Grammar Review)",
        "Nchịkọta: Ọtụtụ Igbo (Oral Literature Complete Review)",
        "Nchịkọta: Akwụkwọ Ọgụgụ (Written Literature Texts Review)",
        "Nchịkọta: Ederede – Ụdị Nile (Composition – All Types)",
        "Ntụgharị Asụsụ Nnwale (Translation Practice): Both Directions",
        "Ọkọlọtọ Asụsụ na Ilu (Vocabulary Mastery and Proverbs)",
        "Ụdaolu Igbo (Phonology): Final Review and Exam Drill",
        "Omenala Igbo (Culture): Complete Review for Examination",
        "WAEC Igbo: Ọlụlụ Oge 1 (Paper 1 – Objectives Format and Drill)",
        "WAEC Igbo: Ọlụlụ Oge 2 (Paper 2 – Essay and Theory Format)",
        "Ọlụlụ Ọnụ Igbo (Oral Igbo Test): Performance Preparation",
        "Nchịkọta na Ọlụlụ (Revision and Examination)",
      ],
      [
        "WAEC Igbo: Ajụjụ Gara Aga – Ọtụtụ (Oral Literature Past Questions)",
        "WAEC Igbo: Ajụjụ Gara Aga – Usoro Asụsụ (Grammar Past Questions)",
        "WAEC Igbo: Ajụjụ Gara Aga – Ogugu na Nkọwa (Comprehension Past Questions)",
        "WAEC Igbo: Ajụjụ Gara Aga – Ederede (Composition Past Questions)",
        "Ọlụlụ Nnwale Nke Nile (Full Mock Examination)",
        "Nzọụkwụ Na-Abụkarị (Common Errors) in WAEC Igbo Answers",
        "Ọrụ Ọszịgbu (Speed Writing Practice) for Examinations",
        "Ngwakọta Ọlụlụ Ọnụ (Oral Interview Preparation)",
        "Nchịkọta Ọrịa: Ọtụtụ na Ihe Nkiri (Intensive Literature Revision)",
        "Nchịkọta Ọrịa: Usoro Asụsụ (Intensive Grammar Revision)",
        "Ọlụlụ Nnwale Ikpeazụ (Last Mock Examination)",
        "Mkparịta Ụka WAEC Nke Ikpeazụ (Final WAEC Preparation)",
      ],
      [
        "Ọtụtụ: Nchịkọta Nke Ikpeazụ (Final Oral Literature Revision)",
        "Usoro Asụsụ: Nchịkọta Nke Ikpeazụ (Final Grammar Revision)",
        "Ederede: Nnwale Nke Ikpeazụ (Final Composition Practice)",
        "Ọlụlụ Nnwale WAEC (WAEC Mock Paper)",
        "Mkparịta Ụka Nke Ikpeazụ (Final Examination Preparation)",
        "Nchịkọta Nke Ikpeazụ (Last Revision Session)",
        "Ọlụlụ Ọha (Final Examination)",
      ]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  HAUSA — SS 1, SS 2, SS 3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "SS 1 – Hausa",
    level: "ss", className: "SS 1", subjectName: "Hausa",
    description: "Hausa Language and Literature for SS 1 covering grammar, oral literature, Al'adu and composition.",
    topics: terms(
      [
        "Haruffan Hausa (Phonology): Tonal System and Sound Review",
        "Ƙamus Hausa (Vocabulary): Advanced Terms and Word Formation",
        "Ginin Jumla (Sentence Construction): Complex Structures",
        "Tatsuniyar Hausa (Folktales): Structure and Cultural Significance",
        "Karin Magana (Proverbs): 40 Proverbs – Meanings and Application",
        "Waka Hausa (Hausa Poetry): Types and Features",
        "Roko (Praise Poetry): Introduction, Features and Examples",
        "Labari Hausa (Hausa Prose): Reading and Contextual Analysis",
        "Rubutu (Composition): Labari – Narrative Writing",
        "Al'adun Hausa (Hausa Culture): Introduction and Key Practices",
        "Wasiƙa (Letter Writing): Wasiƙar Abota na Yara (Informal and Formal)",
        "Bita da Jarabawa (Revision and Examination)",
      ],
      [
        "Ginin Hausa: Jumlolin Da Suka Haɗa (Advanced Sentence Structures)",
        "Sigar Jumla Mai Wahala (Passive and Complex Constructions) in Hausa",
        "Adabin Hausa (Hausa Literature): Written Literary Forms",
        "Waka na Soyayya (Love Poetry): Features and Appreciation",
        "Waka na Addini (Religious Poetry): Themes and Structure",
        "Hausa Drama (Wasan Kwaikwayo): Introduction and Reading",
        "Maganar Baka (Oral Hausa): Formal Oral Composition",
        "Hausa na Yau (Modern Hausa Writing) and Media Language",
        "Hausa a Kafofin Watsa Labarai (Hausa in Mass Media)",
        "Al'adun Aure (Marriage Customs) and Social Practices",
        "Fassara (Translation): English to Hausa",
        "Bita da Jarabawa (Revision and Examination)",
      ],
      [
        "Maganar Baka (Oral Debate) and Discussion in Hausa",
        "Wasan Kwaikwayo (Drama): Reading and Character Analysis",
        "Waka (Poetry): Advanced Appreciation and Literary Value",
        "Rubutu Mai Jayayya (Argumentative Composition) in Hausa",
        "Taƙaitawa (Summary Writing): Techniques and Practice",
        "Bita: Nahawu da Rubutu (Grammar and Composition)",
        "Bita: Adabi da Maganar Baka (Literature and Oral Hausa)",
        "Jarabawa (Final Examination)",
      ]
    ),
  },

  {
    title: "SS 2 – Hausa",
    level: "ss", className: "SS 2", subjectName: "Hausa",
    description: "Hausa Language and Literature for SS 2 with advanced literary appreciation and WAEC preparation.",
    topics: terms(
      [
        "Nahawun Hausa Matakin Ƙoli (Advanced Hausa Grammar): Complex Structures",
        "Sauti na Hausa (Hausa Phonology): Advanced Tone Patterns",
        "Tatsuniya: Nazari Mai Zurfin Bincike (Critical Appreciation of Folktales)",
        "Karin Magana: Ilu 60 da Amfaninsu (60 Proverbs and Their Uses)",
        "Waka Hausa: Nau'o'in Waka Duka (All Forms of Poetry): Advanced Analysis",
        "Roko: Fasalolin Sa da Darajarsa (Advanced Features of Praise Poetry)",
        "Littafin Karatu (Prescribed Prose Text): Theme, Character and Style",
        "Wasan Kwaikwayo (Drama): Structural Analysis and Performance",
        "Rubutu Mai Kwatanci (Descriptive Composition) in Hausa",
        "Hausa a Najeriya ta Zamani (Hausa in Contemporary Nigeria)",
        "Nahawu: Kurakurai Gama Gari (Common Grammar Errors and Corrections)",
        "Bita da Jarabawa (Revision and Examination)",
      ],
      [
        "Adabin Baka: Nazari Cikakke (Complete Oral Literature Appreciation)",
        "Littafin Adabin Rubutu (Literary Text): Critical and Contextual Analysis",
        "Wasiƙar Hukuma (Formal/Official Letter Writing) in Hausa",
        "Rahoto na Hukuma (Official Report Writing) in Hausa",
        "Kalandar Hausa da Lambobi (Hausa Calendar and Number Systems)",
        "Tasirin Musulunci a Al'adun Hausa (Islamic Influence on Hausa Culture)",
        "Bukukuwan Hausa (Hausa Festivals and Ceremonies): Study",
        "Gabatarwar WAEC: Tsarin Takardu (WAEC Format Introduction for Hausa)",
        "Fassara Matakin Ƙoli (Advanced Translation Practice)",
        "Ƙamus na Fasaha (Technical Hausa Vocabulary): Terms and Usage",
        "Sake Duba da Gwaji (Revision and Practice)",
        "Bita da Jarabawa (Revision and Examination)",
      ],
      [
        "Jarabawar WAEC/NECO Hausa: Tsarin Takardu 1 da 2 (Paper Format)",
        "Tambayoyin Baya – Adabin Baka (Past Questions: Oral Literature)",
        "Bita: Nahawu (Grammar Revision)",
        "Bita: Adabi (Literature Revision)",
        "Bita: Rubutu (Composition Revision)",
        "Bita: Maganar Baka (Oral Hausa Revision)",
        "Jarabawar Gwaji Cikakkiya (Mock Examination – Full Paper)",
        "Ƙarshenta Shirya (Final Preparation and Review)",
      ]
    ),
  },

  {
    title: "SS 3 – Hausa",
    level: "ss", className: "SS 3", subjectName: "Hausa",
    description: "Hausa Language and Literature for SS 3 with comprehensive WAEC/NECO revision and examination preparation.",
    topics: terms(
      [
        "Bita Cikakken Nahawu (Comprehensive Grammar Review)",
        "Bita: Adabin Baka (Oral Literature Complete Review)",
        "Bita: Adabin Rubutu (Written Literature Texts Review)",
        "Bita: Rubutu – Nau'o'i Duka (Composition – All Types Review)",
        "Fassara Gwaji (Translation Practice): Both Directions",
        "Ƙamus na Ƙwararru (Vocabulary Mastery) and Idiomatic Expressions",
        "Sauti na Hausa (Phonology): Final Review and Examination Drill",
        "Al'adun Hausa (Culture): Complete Review for Examination",
        "WAEC Hausa: Takarda ta 1 – Nau'i da Shirya (Paper 1 Objectives Format)",
        "WAEC Hausa: Takarda ta 2 – Rubutu da Ka'idoji (Paper 2 Essay Format)",
        "Shirya Jarabawar Maganar Baka (Oral Hausa Test Preparation)",
        "Bita da Jarabawa (Revision and Examination)",
      ],
      [
        "WAEC Hausa: Tambayoyin Baya – Adabin Baka (Oral Literature Past Questions)",
        "WAEC Hausa: Tambayoyin Baya – Nahawu (Grammar Past Questions)",
        "WAEC Hausa: Tambayoyin Baya – Fahimtar Karatu (Comprehension Past Questions)",
        "WAEC Hausa: Tambayoyin Baya – Rubutu (Composition Past Questions)",
        "Jarabawar Gwaji Cikakkiya (Full Mock Examination)",
        "Kurakurai na Yau da Kullum a WAEC Hausa (Common Errors)",
        "Yin Rubutu da Sauri (Speed Writing Practice) for Examinations",
        "Shirya Jarabawar Magana (Oral Interview Preparation)",
        "Bita Mai Zafi: Adabi na Rubutu (Intensive Literature Revision)",
        "Bita Mai Zafi: Nahawu (Intensive Grammar Revision)",
        "Jarabawar Gwaji ta Ƙarshe (Last Mock Examination)",
        "Shirya WAEC ta Ƙarshe (Final WAEC Preparation)",
      ],
      [
        "Bita Adabin Baka ta Ƙarshe (Final Oral Literature Revision)",
        "Bita Nahawu ta Ƙarshe (Final Grammar Revision)",
        "Gwajin Rubutu ta Ƙarshe (Final Composition Practice)",
        "Jarabawar Gwaji WAEC (WAEC Mock Paper)",
        "Shirya Ƙarshenta (Final Examination Preparation)",
        "Bitar Ƙarshe (Last Revision Session)",
        "Jarabawa (Final Examination)",
      ]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  ISLAMIC STUDIES (IRS) — SS 1, SS 2, SS 3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "SS 1 – Islamic Studies",
    level: "ss", className: "SS 1", subjectName: "Islamic Studies",
    description: "Islamic Studies (IRS) for SS 1 covering Tawheed, Ibadah (Worship), Seerah and Islamic Ethics.",
    topics: terms(
      [
        "Tawheed: The Oneness of Allah (Monotheism) – Meaning and Importance",
        "The Attributes of Allah (Al-Asma ul-Husna) – Part 1: First 50 Names",
        "The Attributes of Allah – Part 2: Remaining Names and Their Lessons",
        "Prophethood (Nubuwwah): Role, Qualities and Necessity of Prophets",
        "Prophet Muhammad (SAW): Early Life in Makkah and First Revelation",
        "The Holy Qur'an: Revelation, Compilation and Arrangement",
        "Tafsir: Surah Al-Fatiha – Verse by Verse Analysis and Lessons",
        "Tafsir: Selected Short Surahs – Al-Ikhlas, Al-Falaq, An-Nas",
        "The Five Pillars of Islam: Shahada (Declaration of Faith) and Salat",
        "Taharah (Purification): Wudhu, Ghusl, Tayammum – Rules and Practice",
        "Salat: Times, Conditions, Pillars and Method of Prayer",
        "Revision and Examination",
      ],
      [
        "Pillars of Islam: Zakat (Almsgiving) – Rules, Nisab and Distribution",
        "Pillars of Islam: Sawm (Fasting in Ramadan) – Rules, Conditions and Benefits",
        "Pillars of Islam: Hajj and Umrah – Steps, Conditions and Significance",
        "The Six Articles of Faith (Arkan al-Iman): Overview and Meaning",
        "Belief in Angels (Mala'ikah): Names, Duties and Lessons",
        "Belief in the Revealed Books (Kutub): Torah, Psalms, Gospel and Qur'an",
        "Belief in the Day of Judgement (Yawm al-Qiyamah): Signs and Events",
        "Belief in Divine Decree (Al-Qadar): Types and Islamic Position",
        "Sources of Islamic Law: The Holy Qur'an as Primary Source",
        "Seerah: The Hijrah (Migration to Madinah) – Causes, Events and Lessons",
        "The Constitution of Madinah: Terms and Significance in Islamic Governance",
        "Revision and Examination",
      ],
      [
        "Islamic Ethics: Sidq (Honesty and Truthfulness) in Daily Life",
        "Islamic Ethics: Birrul Walidayn (Respect and Kindness to Parents)",
        "Islamic Social Relations: Ukhuwwah (Brotherhood) and Rights of Muslims",
        "The Rightly Guided Caliphs (Khulafa Rashidun): Overview",
        "Caliphate of Abu Bakr As-Siddiq: Achievements and Challenges",
        "Islam in West Africa: Introduction – Routes and Early Spread",
        "Revision – Faith (Aqeedah) and Worship (Ibadah)",
        "Final Examination",
      ]
    ),
  },

  {
    title: "SS 2 – Islamic Studies",
    level: "ss", className: "SS 2", subjectName: "Islamic Studies",
    description: "Islamic Studies (IRS) for SS 2 covering advanced Fiqh, Hadith Studies, Seerah and Islamic History.",
    topics: terms(
      [
        "Tawheed: Advanced Study – Shirk (Polytheism): Types and Dangers",
        "Prophethood: Signs, Miracles of the Prophets and Their Stories",
        "Tafsir: Surah Al-Baqarah (Verses 1–20): Analysis and Lessons",
        "Hadith Studies: Definition, Types and Classification",
        "The Six Canonical Books of Hadith (Kutub al-Sittah) and Their Compilers",
        "Seerah: The Battle of Badr – Causes, Events and Lessons",
        "Seerah: The Battle of Uhud – Events, Lessons and Aftermath",
        "Seerah: The Battle of the Trench (Khandaq) – Strategy and Outcome",
        "Fiqh: Advanced Rules of Purity (Taharah) – Najasah and Purity",
        "Fiqh: Special Prayers – Jumu'ah (Friday Prayer) and Eid Prayers",
        "Fiqh: Advanced Rules of Fasting – Kaffarah and Special Cases",
        "Revision and Examination",
      ],
      [
        "Islamic Law (Shari'ah): The Sunnah as Secondary Source",
        "Islamic Law: Ijma (Consensus) and Qiyas (Analogy) – Meaning and Use",
        "Qur'an: Tajweed – Makharij al-Huruf (Points of Articulation)",
        "Qur'an: Tajweed – Rules of Noon Sakinah and Tanwin",
        "Qur'an: Tajweed – Rules of Meem Sakinah and Ghunnah",
        "Islamic Family Law: Nikah (Marriage) – Conditions, Pillars and Mahr",
        "Islamic Family Law: Talaq (Divorce) – Types, Rules and Procedures",
        "Islamic Family Law: Mirath (Inheritance) – Shares of Heirs",
        "Islamic Ethics: Sabr (Patience) and Shukr (Gratitude) in Islam",
        "Islamic History: The Umayyad Caliphate – Establishment and Key Events",
        "Islamic History: The Abbasid Caliphate – Rise and Golden Age of Islam",
        "Revision and Examination",
      ],
      [
        "Islam in West Africa: Spread, Key Figures and Centres of Learning",
        "Islam in Nigeria: The Sokoto Jihad of Usman Dan Fodio",
        "Islamic Banking and Finance: Prohibition of Riba (Interest) and Alternatives",
        "Islamic Education (Tarbiyah): Importance, Methods and Institutions",
        "Notable Muslim Scholars: Ibn Battuta, Al-Ghazali, Ibn Khaldun",
        "Contemporary Islamic Issues: Muslims in the Modern World",
        "Revision – Islamic Law and History",
        "Final Examination",
      ]
    ),
  },

  {
    title: "SS 3 – Islamic Studies",
    level: "ss", className: "SS 3", subjectName: "Islamic Studies",
    description: "Islamic Studies (IRS) for SS 3 with comprehensive WAEC/NECO revision across all topics.",
    topics: terms(
      [
        "Comprehensive Tawheed Review: Aqeedah – All Key Topics",
        "Comprehensive Seerah Review: Life of Prophet Muhammad (SAW)",
        "Comprehensive Qur'an and Tafsir Review: Key Surahs and Verses",
        "Comprehensive Hadith Review: Selected Hadith and Their Lessons",
        "Comprehensive Fiqh Review – Worship (Salat, Zakat, Sawm, Hajj)",
        "Comprehensive Fiqh Review – Family Law (Marriage, Divorce, Inheritance)",
        "Islamic History: Complete Review – Rightly Guided Caliphs to Abbasids",
        "Islam in West Africa and Nigeria: Complete Review",
        "WAEC IRS: Paper 1 Format (Objectives) – Practice and Strategies",
        "WAEC IRS: Paper 2 Format (Essay/Theory) – Structure and Marking",
        "Islamic Ethics and Values: Complete Review for Examination",
        "Revision and Examination",
      ],
      [
        "WAEC IRS Past Questions – Tawheed and Aqeedah",
        "WAEC IRS Past Questions – Qur'an and Tafsir",
        "WAEC IRS Past Questions – Hadith Studies",
        "WAEC IRS Past Questions – Fiqh (Worship and Family Law)",
        "WAEC IRS Past Questions – Islamic History and Civilization",
        "Full Mock Examination (WAEC Format)",
        "Common Errors in IRS WAEC Answers and How to Avoid Them",
        "Essay Technique for IRS: How to Answer Theory Questions",
        "Qur'an Recitation Preparation (Oral/Tajweed Component)",
        "Intensive Revision – Aqeedah and Fiqh",
        "Last Mock Examination and Review",
        "Final WAEC Examination Preparation",
      ],
      [
        "Final Tawheed and Aqeedah Revision",
        "Final Qur'an, Tafsir and Hadith Revision",
        "Final Fiqh and Islamic History Revision",
        "WAEC IRS Mock Paper – Full Simulation",
        "Final Examination Preparation",
        "Last Revision Session",
        "Final Examination",
      ]
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed function — gap-fill part 3 (SS language & IRS subjects)
// ─────────────────────────────────────────────────────────────────────────────
export async function seedCurriculumGapFill3(): Promise<{
  added: number;
  topicsAdded: number;
  skipped: number;
  report: string[];
}> {
  console.log("📚 Running Nigerian Curriculum Gap-Fill Part 3 (SS Languages & IRS)...");

  type TRow = typeof curriculumTemplates.$inferSelect;
  const existing = await db.select().from(curriculumTemplates);
  const existingSet = new Set(
    existing.map((t: TRow) => `${t.className}||${t.subjectName}`)
  );

  const report: string[] = [];
  report.push("\n=== SS CURRICULUM GAP-FILL (Part 3) ===");
  report.push("Subjects targeted: Yoruba, Igbo, Hausa, Islamic Studies — SS1, SS2, SS3\n");

  // Audit: show all SS subjects currently in the system
  const ssExisting = existing
    .filter((t: TRow) => t.level === "ss")
    .map((t: TRow) => `${t.className} — ${t.subjectName}`)
    .sort();

  report.push(`=== EXISTING SS TEMPLATES (${ssExisting.length}) ===`);
  ssExisting.forEach((s: string) => report.push(`  ✅ ${s}`));

  let added = 0;
  let topicsAdded = 0;
  let skipped = 0;

  const toAdd: TemplateDef[] = [];
  const willAdd: string[] = [];
  const alreadyHave: string[] = [];

  for (const tpl of T) {
    const key = `${tpl.className}||${tpl.subjectName}`;
    if (existingSet.has(key)) {
      alreadyHave.push(`${tpl.className} — ${tpl.subjectName}`);
      skipped++;
    } else {
      willAdd.push(`${tpl.className} — ${tpl.subjectName}`);
      toAdd.push(tpl);
    }
  }

  report.push(`\n=== AUDIT REPORT ===`);
  report.push(`Subjects found (already exist, ${alreadyHave.length}):`);
  alreadyHave.sort().forEach((s) => report.push(`  ✅ ${s}`));

  report.push(`\nMissing subjects to be added (${willAdd.length}):`);
  willAdd.sort().forEach((s) => report.push(`  ➕ ${s}`));

  for (const tpl of toAdd) {
    try {
      const [inserted] = await db
        .insert(curriculumTemplates)
        .values({
          title: tpl.title,
          level: tpl.level,
          className: tpl.className,
          subjectName: tpl.subjectName,
          description: tpl.description,
          isPublished: true,
        })
        .returning();

      if (tpl.topics.length > 0) {
        const rows = tpl.topics.map((t, i) => ({
          templateId: inserted.id,
          term: t.term,
          weekNumber: t.week,
          orderNumber: i,
          name: t.name,
          description: t.description ?? null,
        }));
        await db.insert(curriculumTemplateTopics).values(rows);
        topicsAdded += rows.length;
      }
      added++;
      report.push(`  ✅ Added: ${tpl.title} (${tpl.topics.length} topics)`);
    } catch (err: any) {
      report.push(`  ❌ ERROR inserting ${tpl.title}: ${err?.message}`);
    }
  }

  report.push(`\n=== RESULT ===`);
  report.push(`  Templates added:    ${added}`);
  report.push(`  Topics imported:    ${topicsAdded}`);
  report.push(`  Skipped (exist):    ${skipped}`);
  report.push(`  Grand total now:    ${existing.length + added}`);

  if (added === 0) {
    report.push(`\n  ℹ️  No new templates needed — all targeted subjects already exist.`);
  } else {
    report.push(`\n  🎉 Successfully added ${added} SS language/IRS curriculum templates.`);
  }

  console.log(`✅ Gap fill Part 3 complete: ${added} templates, ${topicsAdded} topics added.`);
  return { added, topicsAdded, skipped, report };
}
