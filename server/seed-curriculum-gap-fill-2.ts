/**
 * Nigerian Curriculum Gap-Fill Seed — Part 2
 *
 * Covers the remaining Primary 1–6 subjects and JSS 1–3 Nigerian languages:
 *
 * PRIMARY 1–6 (new subjects per class):
 *   Basic Technology, Computer Studies/ICT, Civic Education, Security Education,
 *   Agricultural Science, Home Economics, Cultural and Creative Arts, Music,
 *   Fine Arts, CRS, IRS, PHE, Yoruba, Igbo, Hausa, French,
 *   Verbal Reasoning, Quantitative Reasoning, Handwriting
 *
 * JSS 1–3:
 *   Yoruba, Igbo, Hausa
 *
 * Sources: scholarclopedia.com/ng, syllabus.ng, UBE primary scheme of work.
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
  //  BASIC TECHNOLOGY — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Basic Technology",
    level: "primary", className: "Primary 1", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 1 introducing tools, safety, simple drawing and materials.",
    topics: terms(
      ["Introduction to Basic Technology: What It Is and Why We Need It","Tools We Use at Home: Hammer, Nail, Knife","Tools We Use at School: Ruler, Scissors, Pencil","Safety Rules: How to Use Tools Safely","Materials Around Us: Wood, Metal, Plastic","Hard and Soft Materials","Making Simple Things: Paper Folding","Drawing Straight Lines with a Ruler","Simple Shapes: Circle, Square, Triangle","Making Things with Clay","Joining Materials: Glue and Tape","Revision and Examination"],
      ["Types of Buildings Around Us","What Buildings Are Made Of: Bricks and Cement","Water in Our Homes: Taps and Pipes","Electricity at Home: Lights and Switches","Safety with Electricity: What Not to Touch","Machines We Use: Blender, Fan, Iron","Wheels: What They Are and Their Uses","Simple Bridges: How They Work","Roads and Paths: Types","Drawing My House","Making a Simple Model House","Revision and Examination"],
      ["Plants and Technology: Using Plants","Animals and Technology: Using Animals","Recycling: Making New Things from Old","Waste and How to Manage It","Technology Around Us","Review: Tools and Materials","Examination"]
    ),
  },
  {
    title: "Primary 2 – Basic Technology",
    level: "primary", className: "Primary 2", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 2 covering tools, simple constructions and how things work.",
    topics: terms(
      ["Review: Tools and Their Uses","Measuring Tools: Ruler and Tape Measure","Drawing: Freehand Sketching of Simple Objects","Materials: Natural and Man-Made","Wood: Simple Uses","Metal: Simple Uses","Plastic: Simple Uses","Making a Pencil Box","Making a Simple Kite","Paper Construction: Paper Bag","Joining Techniques: Nails and Screws","Revision and Examination"],
      ["Simple Machines: The Lever","Simple Machines: The Wheel and Axle","Simple Machines: The Inclined Plane","Pulleys: What They Do","Energy: What Gives Machines Power","Wind Energy: Windmills","Water Energy: Water Wheel","Solar Energy: The Sun","Drawing: My Simple Machine","Construction: Simple Balance Scale","Safety in the Workshop","Revision and Examination"],
      ["Simple Structures: Bridges","Technology in Transport: Bicycle","Technology in Communication: Radio","Drawing Vehicles","Making a Simple Mobile","Revision and Safety Review","Examination"]
    ),
  },
  {
    title: "Primary 3 – Basic Technology",
    level: "primary", className: "Primary 3", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 3 covering materials technology, simple electricity and drawing.",
    topics: terms(
      ["Introduction to Technical Drawing: Equipment","Drawing Lines: Vertical, Horizontal, Diagonal","Drawing Shapes: Square, Rectangle, Circle","Drawing: Freehand Sketch of a House","Properties of Materials: Hard, Soft, Flexible","Metals: Common Types and Uses","Wood: Types – Hardwood and Softwood","Cutting Tools: Saw and Chisel (Safety)","Measuring: Using a Ruler Accurately","Joining Wood: Simple Nail Joint","Surface Finishing: Sandpaper","Revision and Examination"],
      ["Electricity: What Is It?","Electrical Components: Battery, Wire, Bulb","Making a Simple Circuit","Safety: Electrical Hazards","Simple Machines Review: Levers","Simple Machines: Gears – Introduction","Technology in Agriculture: Tractor","Technology in Medicine: Thermometer","Technology in Communication: Telephone","Structures: What Makes a Strong Structure?","Making a Simple Frame Structure","Revision and Examination"],
      ["Environmental Technology: Water Treatment","Renewable Energy: Wind and Solar","Technology Project: Make a Windmill","Drawing: Technical Shapes","Revision and Technology Review","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Basic Technology",
    level: "primary", className: "Primary 4", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 4 covering advanced drawing, electrical circuits and structures.",
    topics: terms(
      ["Technical Drawing: Equipment and Lines","Geometrical Drawing: Angles","Geometrical Drawing: Regular Shapes","Drawing: Plan View and Side View","Materials Technology: Metals – Iron and Steel","Materials Technology: Aluminium","Casting and Moulding: Simple Concepts","Woodwork: Making a Simple Shelf","Measurement: Scale Drawing – Introduction","Electrical Circuit: Components","Electrical Circuit: Parallel and Series","Revision and Examination"],
      ["Electronics: Radio Components (Simple)","Technology in Agriculture: Irrigation","Technology in Construction: Cranes","Technology in Transport: Engine (Simple)","Energy: Fossil Fuels","Energy: Renewable Sources – Solar Panels","Structures: Beams and Bridges","Making a Simple Bridge Model","Safety at Work: Rules and First Aid","Drawing: A Simple Machine","Technical Project: Wind Vane","Revision and Examination"],
      ["Environmental Technology: Waste Management","ICT and Basic Technology","Technology and Development in Nigeria","Drawing Review","Project Presentation","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Basic Technology",
    level: "primary", className: "Primary 5", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 5 covering advanced constructions, mechanisms and design.",
    topics: terms(
      ["Technical Drawing: Orthographic Introduction","Drawing: Plan, Elevation and Side View","Geometrical Constructions: Bisecting Angles","Materials: Alloys and Composite Materials","Woodwork: Joints – Butt and Lap","Metalwork: Cutting and Filing (Simple)","Casting: Sand Casting (Simple)","Mechanisms: Cams and Cranks","Hydraulics: Simple Concept","Electricity: Ohm's Law (Simple)","Simple Electronic Circuit: LED and Resistor","Revision and Examination"],
      ["Structures: Load-Bearing","Structures: Arch and Truss","Building Technology: Foundation Types","Plumbing: Water Supply (Simple)","Agricultural Technology: Sprinkler","Energy Conservation Techniques","Solar Panel: How It Works","Wind Turbine: How It Works","Drawing: Simple Architectural Plan","Technical Project: Model Building","ICT Tools in Technology","Revision and Examination"],
      ["Emerging Technology: Robotics (Introduction)","3D Printing: What Is It?","Technology and the Environment","FSLC Technology: Revision","Drawing Practice","Project Presentation","Examination"]
    ),
  },
  {
    title: "Primary 6 – Basic Technology",
    level: "primary", className: "Primary 6", subjectName: "Basic Technology",
    description: "Basic Technology for Primary 6 with FSLC preparation across all technology topics.",
    topics: terms(
      ["Technical Drawing Revision: All Topics","Geometry Review: Constructions","Materials Review: Properties and Uses","Woodwork Review: Joints and Tools","Electricity Review: Circuits","Electronics Review: Components","Mechanisms Review: Machines","Structures Review: Bridges and Buildings","Energy Review: Renewable and Non-renewable","Agricultural Technology Review","Environmental Technology Review","Revision and Examination"],
      ["FSLC Basic Technology: Objectives Practice","FSLC Basic Technology: Theory Questions","Drawing Practice: Past Questions","Project: Design a Simple Machine","Safety Review","Technology in Society","Past Questions Practice","Mock FSLC","Examination Techniques","Construction Project","Portfolio Review","Revision and Examination"],
      ["Final Revision: Drawing","Final Revision: Materials and Machines","Final Revision: Electricity","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPUTER STUDIES / ICT — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Computer Studies",
    level: "primary", className: "Primary 1", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 1: introduction to computers, parts and basic use.",
    topics: terms(
      ["What Is a Computer? Meaning and Uses","Parts of a Computer: Monitor, Keyboard, Mouse","The Monitor: What We See on the Screen","The Keyboard: Letters and Numbers","The Mouse: Click and Point","Turning the Computer On and Off","Using the Mouse: Moving and Clicking","Typing My Name on the Keyboard","The Desktop: Icons and Wallpaper","Opening and Closing Programs","Colouring on Paint (Introduction)","Revision and Examination"],
      ["Types of Computers: Desktop and Laptop","Tablet and Smartphone","Memory: What the Computer Remembers","Storage: Hard Drive and USB Stick","Computer Games: Educational Games","Safety Online: Never Give Out Your Name","Cyberbullying: What It Is","Typing Practice: Letters A–M","Typing Practice: Letters N–Z","Drawing with Paint","Saving Your Work","Revision and Examination"],
      ["Computer in Our Daily Life","Computer at Home and at School","Review: Parts of Computer","Typing Practice","Fun with Computers: Math Games","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Computer Studies",
    level: "primary", className: "Primary 2", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 2 covering keyboard skills, simple documents and programs.",
    topics: terms(
      ["Review: Parts of the Computer","The Keyboard: Special Keys – Backspace, Space, Enter","Typing: Uppercase and Lowercase","Number Keys and Symbols","Mouse Practice: Double Click and Right Click","Opening Microsoft Word","Typing Sentences in Word","Formatting Text: Bold, Italic, Underline","Changing Font Size and Colour","Saving a Document","Printing a Document (Introduction)","Revision and Examination"],
      ["Microsoft Paint: Drawing Tools","Paint: Using Colours","Paint: Drawing Shapes","Introduction to PowerPoint Slides","Adding Text to a Slide","Adding Pictures to a Slide","Internet: What Is It?","Websites: What Are They?","Search Engine: Typing a Search","Email: What Is It?","Safety on the Internet","Revision and Examination"],
      ["Computers and Society: How Computers Help","Computer Viruses: What They Are","Review: Microsoft Word","Typing Practice: Paragraphs","Fun Projects: My Computer Poster","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Computer Studies",
    level: "primary", className: "Primary 3", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 3 covering word processing, spreadsheets and internet basics.",
    topics: terms(
      ["Hardware vs Software: Review","Operating System: Windows Desktop","File Management: Creating Folders","Microsoft Word: Page Setup","Word: Tables – Creating and Filling","Word: Inserting Pictures from File","Typing Speed Practice","Spell Check and Grammar Check","Word: Bullet Points and Lists","Word: Headers and Footers","Printing: Page Preview","Revision and Examination"],
      ["Introduction to Microsoft Excel","Excel: Rows, Columns and Cells","Excel: Typing Numbers and Text","Excel: Simple Addition Formula","Excel: Simple Charts – Bar Chart","PowerPoint: Slide Layout","PowerPoint: Inserting Shapes","PowerPoint: Slide Transitions","Internet: Browsing a Website","Internet: Bookmarking a Page","Downloading a File Safely","Revision and Examination"],
      ["Computer Maintenance: Cleaning the Screen","Anti-Virus: Why It Matters","Review: Word and Excel","Simple Project: Class Newsletter","ICT in Agriculture","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Computer Studies",
    level: "primary", className: "Primary 4", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 4 covering advanced applications and internet literacy.",
    topics: terms(
      ["Computer Generation: History","Computer Networks: LAN and WAN (Simple)","Internet: How It Works (Simple)","Web Browser: Chrome and Firefox","Search Engines: Google and Yahoo","Email: Composing and Sending","Email: Attachments","Online Safety: Passwords","Social Media: Benefits and Dangers","Cybercrime: Types","Reporting Online Problems","Revision and Examination"],
      ["Microsoft Word: Mail Merge (Simple)","Excel: IF Function (Simple)","Excel: Multiple Charts","PowerPoint: Presentation Skills","Google Docs and Drive (Introduction)","Digital Photography: Taking Photos","Video: Simple Recording","Introduction to Scratch Programming","Scratch: Sprites and Backgrounds","Scratch: Simple Animation","Scratch: Making a Story","Revision and Examination"],
      ["ICT in Healthcare","ICT in Banking","ICT in Education","Review: Internet Safety","Scratch Mini-Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Computer Studies",
    level: "primary", className: "Primary 5", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 5 covering programming, databases and advanced applications.",
    topics: terms(
      ["Computer Architecture: CPU and Memory","Binary Numbers: 0 and 1","Binary to Decimal Conversion","Input and Output Devices: Advanced","Storage Devices: Cloud Storage","Operating Systems: Functions","Network Security: Firewall","Excel: VLOOKUP (Simple)","Excel: Conditional Formatting","Database: What Is a Database?","Microsoft Access: Simple Table","Revision and Examination"],
      ["Database: Queries in Access","Database: Reports","Scratch: Advanced: Loops and Conditions","Scratch: Game Making","HTML: Basic Web Page Tags","HTML: Adding Images and Links","CSS: Colouring a Web Page (Simple)","Python: Introduction (Simple)","Python: Print Statement","Python: Variables","Python: Simple Calculator","Revision and Examination"],
      ["ICT Project: Simple Website","ICT and Government: E-Government","Review: Programming Concepts","Review: Database","FSLC ICT Revision","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Computer Studies",
    level: "primary", className: "Primary 6", subjectName: "Computer Studies",
    description: "Computer Studies / ICT for Primary 6 with FSLC preparation and advanced ICT skills.",
    topics: terms(
      ["Computer Studies Review: Hardware","Computer Studies Review: Software","Networking Review","Internet Safety Review","Word Processing Review","Spreadsheet Review","Database Review","Programming Review: Scratch","Python Review","HTML/CSS Review","ICT in Society Review","Revision and Examination"],
      ["FSLC ICT: Objectives Practice","FSLC ICT: Theory Questions","Past Questions Practice","Mock ICT Examination","Typing Speed Test","ICT Project: Design a School Newsletter","Scratch Game Presentation","Python: Simple Program Presentation","Web Page Presentation","Examination Techniques","Portfolio Review","Revision and Examination"],
      ["Final Revision: Hardware and Software","Final Revision: Applications","Final Revision: Internet and Safety","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  CIVIC EDUCATION — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Civic Education",
    level: "primary", className: "Primary 1", subjectName: "Civic Education",
    description: "Civic Education for Primary 1: national symbols, school rules and community belonging.",
    topics: terms(
      ["Who Am I? My Name and My Country","Nigerian Flag: Colours and Meaning","The Nigerian Coat of Arms","The National Anthem: First Stanza","The National Pledge","My School: Rules We Follow","Good Behaviour at School","Respect for Teachers and Elders","Honesty: Telling the Truth","Sharing: Being Kind to Others","Love for Nigeria","Revision and Examination"],
      ["My Community: People in It","Community Helpers: Teachers, Doctors","Market: Buying and Selling","Transportation: How We Move","Communication: How We Talk to Each Other","Good Citizenship: Keeping Our Environment Clean","Throwing Rubbish in the Bin","Using Water Wisely","Protecting Our Trees and Plants","Road Safety: Looking Before Crossing","Stop, Look and Listen","Revision and Examination"],
      ["Nigeria's Neighbours","Festivals in Nigeria: Christmas, Eid","Being a Good Friend","Helping People in Need","Review: National Symbols","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Civic Education",
    level: "primary", className: "Primary 2", subjectName: "Civic Education",
    description: "Civic Education for Primary 2 covering family, community, leadership and rights.",
    topics: terms(
      ["Rights of a Child: What Are They?","Child Rights Act: Simple Explanation","Duties of a Child at Home","Duties of a Child at School","Child Abuse: What It Is","How to Report Child Abuse","Government: What It Does","The President of Nigeria","State Governor: What He Does","Local Government Chairman","My Vote Matters: Why Elections Are Important","Revision and Examination"],
      ["Corruption: What It Is","Being Honest in School","Anti-Social Behaviour: Stealing, Lying","Consequences of Bad Behaviour","Good Values: Respect, Kindness, Fairness","Cultural Values in Nigeria","Religious Values: Love and Peace","Unity in Diversity","Nigeria's Languages and Cultures","Inter-Ethnic Respect","Conflict Resolution: Peaceful Methods","Revision and Examination"],
      ["Nigerian Economy: Simple Meaning","Buying Nigerian Goods","Protecting Public Property","Caring for the Environment","Review: Rights and Duties","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Civic Education",
    level: "primary", className: "Primary 3", subjectName: "Civic Education",
    description: "Civic Education for Primary 3 covering democracy, government and national development.",
    topics: terms(
      ["Democracy: Meaning and Importance","Elections: How We Choose Leaders","Voting: Secret Ballot","Political Parties: What They Do","INEC: Its Functions","The Executive Arm of Government","The Legislative Arm: Making Laws","The Judicial Arm: Upholding Justice","Federalism in Nigeria (Simple)","State and Federal Government","Local Government: Roles","Revision and Examination"],
      ["Rule of Law: Everyone Is Equal Before the Law","Human Rights: Freedom of Speech","Freedom of Religion","Right to Education","Right to Health","Responsibilities: Paying Taxes (Simple)","Responsibilities: Obeying Laws","Environmental Responsibilities","Volunteerism: Helping the Community","Gender Equality: Boys and Girls Are Equal","Women in Leadership","Revision and Examination"],
      ["Nigeria and the African Union","Nigeria and the United Nations","Peace and Security","Review: Government and Democracy","Civic Education in My Life","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Civic Education",
    level: "primary", className: "Primary 4", subjectName: "Civic Education",
    description: "Civic Education for Primary 4 covering constitutional rights, duties and social responsibility.",
    topics: terms(
      ["The Nigerian Constitution: What It Is","Key Provisions of the 1999 Constitution","Fundamental Rights: The Right to Life","Freedom of Association","Freedom of Movement","The Nigerian Police: Functions","The Nigerian Army: Functions","EFCC and ICPC: Fighting Corruption","Drug Abuse: Effects on Society","Human Trafficking: What Is It?","Protecting Yourself from Traffickers","Revision and Examination"],
      ["Political Apathy: Why People Don't Vote","Encouraging Civic Participation","Civil Society: NGOs and Their Roles","The Media: TV, Radio, Newspapers","Social Media: Responsible Use","Environmental Citizenship","Plastic Pollution and What to Do","Water Conservation","Energy Conservation","Noise Pollution","Community Service: How to Help","Revision and Examination"],
      ["Nigeria's National Development Plans","SDGs: What Are They?","Nigeria and Global Citizenship","Review: Rights and Responsibilities","Civic Project: Clean-Up Campaign","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Civic Education",
    level: "primary", className: "Primary 5", subjectName: "Civic Education",
    description: "Civic Education for Primary 5 covering advanced governance, rights and global awareness.",
    topics: terms(
      ["Constitutional Democracy: Advanced","Separation of Powers: Detailed Study","Checks and Balances","Electoral Process: Step by Step","Civic Participation: Youth Role","Political Consciousness","Anti-Corruption: Citizens' Roles","Whistleblowing: Speaking Up","Social Justice: Fairness for All","Gender Discrimination: Effects","Gender Equity Policies in Nigeria","Revision and Examination"],
      ["Security Challenges in Nigeria","Terrorism: What It Is and Prevention","Drug Abuse: National Response","Cybercrime Laws in Nigeria","Consumer Rights and Protection","Labour Rights: Child Labour","Education as a Right","Inclusive Education: Disabilities","Climate Change: Civic Response","Sustainable Development Goals in Nigeria","Nigeria's Foreign Policy Basics","Revision and Examination"],
      ["International Organisations: UN, AU, ECOWAS","Nigeria's Peace Keeping Role","Global Citizenship Education","Review: Constitutional Democracy","Civic Action Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Civic Education",
    level: "primary", className: "Primary 6", subjectName: "Civic Education",
    description: "Civic Education for Primary 6 with FSLC preparation across all civic topics.",
    topics: terms(
      ["Government and Governance Review","Democracy and Elections Review","Constitutional Rights Review","Civic Duties and Responsibilities Review","Human Rights Review","Rule of Law Review","Federalism Review","Anti-Corruption Review","Social Values Review","Environmental Citizenship Review","International Organisations Review","Revision and Examination"],
      ["FSLC Civic Education: Objectives","FSLC Civic Education: Theory","Past Questions Practice","Mock Examination","Civic Education Project","Community Survey Report","Presentation: Civic Rights","Review: National Symbols","Topical Issues in Nigeria","Examination Techniques","Portfolio Review","Revision and Examination"],
      ["Final Revision: Government","Final Revision: Rights and Duties","Final Revision: Values","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  SECURITY EDUCATION — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Security Education",
    level: "primary", className: "Primary 1", subjectName: "Security Education",
    description: "Security Education for Primary 1: personal safety, stranger danger and home safety.",
    topics: terms(
      ["What Is Security? Keeping Safe","My Body: Private Parts (Staying Safe)","Stranger Danger: Don't Talk to Strangers","Safe Adults: Who Can Help Me","Unsafe Situations: What to Do","Home Safety: Fire Hazards","Kitchen Safety: Hot Pots","Electrical Safety: Don't Touch Plugs","Road Safety: Look Before You Cross","Traffic Lights: Red, Yellow, Green","Pedestrian Crossing","Revision and Examination"],
      ["Water Safety: Don't Go Near Deep Water Alone","School Safety: Fighting Is Wrong","Bullying: What It Is and How to Stop It","Safe Touch vs Unsafe Touch","Saying No: It Is Okay to Say No","Telling a Trusted Adult","Emergency Numbers: Police 112, Fire 112","First Aid: Calling for Help","Neighbourhood Watch: Looking Out for Each Other","Safe Routes to School","Keeping My Belongings Safe","Revision and Examination"],
      ["Safe Internet Use (Introduction)","Suspicious Objects: What to Do","Community Security: The Police","Review: Staying Safe","Personal Safety Plan","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Security Education",
    level: "primary", className: "Primary 2", subjectName: "Security Education",
    description: "Security Education for Primary 2 covering personal security, disaster readiness and community safety.",
    topics: terms(
      ["Types of Security: Personal, Home, Community","Why Security Is Important","Dangers in the Home: Sharp Objects","Dangers in the Home: Poisonous Substances","Playground Safety: Safe Play Rules","Wearing Appropriate Clothing for Safety","Bicycle Safety: Wearing a Helmet","Road Safety: Pedestrian Rules","Seat Belts: Why We Wear Them","Vehicle Safety: Never in the Trunk","Safe School Routes","Revision and Examination"],
      ["Drug Safety: Not Taking Unknown Substances","Food Safety: Checking Expiry Dates","Water Safety: Clean Drinking Water","Disaster Preparedness: Fire Drill","What to Do in a Fire","Flood Safety: Higher Ground","Earthquake Safety (Introduction)","Storm Safety","First Aid: Burns","First Aid: Choking","First Aid: Drowning Response","Revision and Examination"],
      ["Community Policing: Role of Citizens","Security Agencies in Nigeria","Cybersecurity: Password Protection (Simple)","Review: Safety at Home and School","Safety Contract: My Commitment","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Security Education",
    level: "primary", className: "Primary 3", subjectName: "Security Education",
    description: "Security Education for Primary 3 covering crime prevention, cyber safety and disaster management.",
    topics: terms(
      ["Crime: Types of Crime","Crime Prevention: What We Can Do","Petty Crime: Pickpocketing and Theft","Vandalism: Destroying Public Property","Fraud: What It Is","Social Vices: Drug Abuse and Its Dangers","Cultism: What It Is and Why to Avoid","Secret Societies: Dangers","Peer Pressure: Saying No","Good Friends vs Bad Influences","Reporting Crime: Police Station","Revision and Examination"],
      ["Cybercrime: Hacking and Scams","Online Safety: Not Sharing Personal Info","Safe Websites for Children","Screen Time: Healthy Limits","Social Media: Age Restrictions","Cyberbullying: Reporting It","Digital Footprint: What You Post Online","Emergency Services: Police, Fire, Ambulance","Community Safety: Neighbourhood Watch","Security in Public Places","Personal Security Plans","Revision and Examination"],
      ["Security and Human Rights","Security During Emergencies","Disaster Management: Agencies","Review: Online and Personal Safety","Safety Poster Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Security Education",
    level: "primary", className: "Primary 4", subjectName: "Security Education",
    description: "Security Education for Primary 4 covering terrorism awareness, trafficking and national security.",
    topics: terms(
      ["National Security: What It Means","Threats to National Security","Terrorism: Definition and Forms","Boko Haram: Impact on Nigeria (Factual)","Banditry and Kidnapping: Awareness","Human Trafficking: Recognition","Child Labour: Identification and Reporting","Online Predators: Warning Signs","Social Media Dangers for Children","Safety at Religious Events","Safety at Crowded Places","Revision and Examination"],
      ["Security Agencies: Police Roles","Security Agencies: DSS and NIA","Immigration: Border Security","Customs: Preventing Smuggling","EFCC: Combating Financial Crime","NDLEA: Drug Law Enforcement","Cyber Police: Reporting Cybercrime","First Aid: CPR for Children","Fire Safety: Extinguisher Use","Flood Evacuation Plan","Safe Evacuation: School Drill","Revision and Examination"],
      ["Peace Building: My Role","Conflict Prevention","Whistleblowing: Civic Duty","Review: National Security Agencies","Security Project: Safety Plan for School","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Security Education",
    level: "primary", className: "Primary 5", subjectName: "Security Education",
    description: "Security Education for Primary 5 with advanced crime prevention, cyber security and ethics.",
    topics: terms(
      ["Security: A Global Perspective","Nigeria's Security Challenges: Overview","Terrorism: Global Impact","Cybersecurity: Threats and Protection","Identity Theft: Prevention","Financial Fraud: Online Scams","Drug Trafficking: Routes and Impact","Small Arms: Dangers","Child Soldiers: Human Rights Issue","Environmental Security: Resource Conflicts","Climate and Security Link","Revision and Examination"],
      ["Security Sector Reform in Nigeria","Community Policing: Best Practices","Crime Statistics: Reading Data","School Safety Policy","Anti-Bullying Strategies","Mental Health and Security","Psychological Effects of Insecurity","Media Literacy: Detecting Fake News","Disinformation and Security","Human Rights and Security","The Role of Youth in Security","Revision and Examination"],
      ["Peace Education: Concepts","Non-Violent Communication","Security Project: Community Survey","Review: Cybersecurity and Crime","Security and Development Link","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Security Education",
    level: "primary", className: "Primary 6", subjectName: "Security Education",
    description: "Security Education for Primary 6 with FSLC preparation and comprehensive security review.",
    topics: terms(
      ["Security Education Review: Personal Safety","Security Review: Home and School","Security Review: Cyber Safety","Security Review: National Security","Security Review: Community Safety","Security Agencies Review","Crime Prevention Review","Emergency Response Review","First Aid Review","Disaster Management Review","Peace and Conflict Review","Revision and Examination"],
      ["FSLC Security Education: Objectives","Theory Questions Practice","Past Questions Practice","Security Project Presentation","Mock Examination","Examination Techniques","Security Awareness Campaign","Peace Advocacy Project","Safety Handbook Creation","Portfolio Review","Oral Presentation","Revision and Examination"],
      ["Final Revision: Personal Security","Final Revision: National Security","Final Revision: Cybersecurity","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  AGRICULTURAL SCIENCE — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Agricultural Science",
    level: "primary", className: "Primary 1", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 1 introducing farming, plants, animals and the soil.",
    topics: terms(
      ["What Is Agriculture? Meaning and Importance","Types of Farming: Food Farm, Animal Farm","Farmers and Their Work","Farm Tools: Hoe, Cutlass, Rake","Safety on the Farm","Plants on the Farm: Vegetables","Plants on the Farm: Fruits","Plants on the Farm: Grains","Animals on the Farm: Chicken, Goat, Cow","Animals on the Farm: Fish, Pig","Soil: What Is It?","Revision and Examination"],
      ["Planting Seeds: How It Is Done","Watering Plants: Why Plants Need Water","Sunlight: Why Plants Need the Sun","Weeds: What They Are and Why to Remove","Pests: Insects That Harm Plants","Harvesting: How We Pick Crops","Storing Crops: How to Keep Them","Food from Plants: Rice, Yam, Tomato","Food from Animals: Milk, Eggs, Meat","Farmers in My Community","Helping on the Farm","Revision and Examination"],
      ["Importance of Agriculture to Nigeria","Simple Farm Project: Growing a Plant","Farm Records: Simple Counting","Review: Plants and Animals","Agricultural Celebration: Farm Day","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Agricultural Science",
    level: "primary", className: "Primary 2", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 2 covering soil types, crop growing and simple animal rearing.",
    topics: terms(
      ["Types of Soil: Sandy, Clay and Loam","Properties of Soil: Colour and Texture","Best Soil for Farming: Loam","Preparing the Farm: Clearing and Tilling","Planting: Seeds and Seedlings","Spacing: How Far Apart to Plant","Manure: Natural Fertiliser","Compost: Making Compost at Home","Weeding: Manual and Simple Chemical","Irrigation: Watering the Farm","Harvesting: Methods","Revision and Examination"],
      ["Food Crops: Maize, Cassava, Yam","Cash Crops: Cocoa, Cotton","Vegetables: Tomato, Spinach, Pepper","Fruits: Mango, Orange, Pineapple","Poultry: Types – Chicken, Turkey, Duck","Poultry Housing: Simple Pen","Feeding Chickens: Types of Feed","Goats: Housing and Feeding","Fish: Types in Nigeria","Fishing Methods: Simple","Farm Records: Simple Diary","Revision and Examination"],
      ["Agricultural Tools: Identification","Farm Safety: Rules","Simple Farm Visit","Review: Crops and Animals","Farm Art: Draw Your Farm","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Agricultural Science",
    level: "primary", className: "Primary 3", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 3 covering crop production, pest control and animal care.",
    topics: terms(
      ["Agriculture and National Development","Types of Agriculture: Subsistence and Commercial","Crop Rotation: Meaning and Benefits","Mixed Farming: Crops and Animals Together","Soil Erosion: Causes and Prevention","Fertilisers: Organic and Inorganic","Crop Diseases: Common Types","Crop Pests: Insects and Rodents","Pest Control: Biological and Chemical","Harvesting Techniques: Different Crops","Post-Harvest: Drying and Storing","Revision and Examination"],
      ["Animal Husbandry: Meaning and Importance","Cattle Farming: Nigerian Breeds","Sheep and Goat: Importance","Pig Rearing: Housing and Feeding","Rabbit Rearing: Introduction","Poultry Production: Layers and Broilers","Animal Diseases: Common Types","Vaccination: Why Animals Need It","Aquaculture: Fish Farming Basics","Forestry: Trees and Their Uses","Farm Mechanisation: Simple Tools","Revision and Examination"],
      ["Agricultural Cooperative: Simple Meaning","Marketing Farm Products","Career in Agriculture","Farm Visit and Report","Simple Farm Experiment","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Agricultural Science",
    level: "primary", className: "Primary 4", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 4 covering advanced crop science, irrigation and livestock.",
    topics: terms(
      ["Crop Physiology: How Plants Grow","Germination: Conditions Needed","Vegetative Propagation: Cuttings","Plant Nutrients: NPK","Soil pH: Acidic and Alkaline Soils","Liming: Correcting Soil Acidity","Irrigation: Types – Drip and Sprinkler","Drainage: Removing Excess Water","Weed Types: Grasses and Broadleaf","Herbicides: Safe Use","Integrated Pest Management","Revision and Examination"],
      ["Livestock Nutrition: Feeds and Additives","Dairy Farming: Milk Production","Beef Production: Nigerian Cattle","Apiculture: Beekeeping Basics","Silkworm Farming: Introduction","Processing: Cassava to Garri","Processing: Tomato to Paste","Preservation: Smoking and Salting","Agricultural Marketing","Farm Economics: Cost and Profit","Farm Records: Income and Expenditure","Revision and Examination"],
      ["Sustainable Agriculture","Organic Farming: Principles","Agro-Forestry: Trees on the Farm","Agricultural Extension Services","Review: Crop and Animal Production","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Agricultural Science",
    level: "primary", className: "Primary 5", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 5 covering biotechnology, agribusiness and modern farming.",
    topics: terms(
      ["Agricultural Biotechnology: What Is It?","Hybrid Seeds: What Are They?","GMO Crops: Benefits and Concerns","Tissue Culture: Simple Explanation","Precision Agriculture: GPS Farming","Smart Farming: Technology on the Farm","Hydroponics: Growing Without Soil","Aquaponics: Fish and Plants Together","Climate-Smart Agriculture","Carbon Farming: Reducing Emissions","Post-Harvest Technology: Cold Storage","Revision and Examination"],
      ["Agribusiness: Starting a Farm Business","Business Plan for a Small Farm","Agricultural Loans: NIRSAL","Cooperative Societies: Formation","Agricultural Insurance","Commodity Exchange","Export of Agricultural Products","NAFDAC: Food Standards","Organic Certification","Marketing Agricultural Products Online","Future of Agriculture in Nigeria","Revision and Examination"],
      ["Careers in Agriculture: Types","Agricultural Education","Review: Modern Farming","Agricultural Project: School Garden","Farm Report Writing","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Agricultural Science",
    level: "primary", className: "Primary 6", subjectName: "Agricultural Science",
    description: "Agricultural Science for Primary 6 with FSLC preparation.",
    topics: terms(
      ["Agricultural Science Review: Soil and Crops","Animal Production Review","Farm Mechanisation Review","Post-Harvest Technology Review","Agribusiness Review","Agricultural Biotechnology Review","Environmental Agriculture Review","Farm Records Review","Agricultural Marketing Review","Agricultural Policy Review","Careers in Agriculture Review","Revision and Examination"],
      ["FSLC Agriculture: Objectives","FSLC Agriculture: Theory Questions","Past Questions Practice","Practical Agriculture Assessment","School Garden Project","Mock Examination","Farm Report","Examination Techniques","Agricultural Exhibition","Portfolio Review","Community Farm Visit","Revision and Examination"],
      ["Final Revision: Crop Production","Final Revision: Animal Production","Final Revision: Agribusiness","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  HOME ECONOMICS — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Home Economics",
    level: "primary", className: "Primary 1", subjectName: "Home Economics",
    description: "Home Economics for Primary 1: food, clothing, home care and family.",
    topics: terms(
      ["Introduction to Home Economics","My Home: Parts of the House","Keeping My Home Clean","My Bedroom: Tidying Up","The Kitchen: Safety Rules","Food: Good Food and Bad Food","The Food Plate: What to Eat","Breakfast: Why It Is Important","Washing Hands Before Eating","Fruits We Should Eat","Vegetables We Should Eat","Revision and Examination"],
      ["Clothing: Types of Clothes","School Uniform: Caring for It","Washing My Clothes (Simple)","Hanging and Folding Clothes","Shoes: Keeping Them Clean","My Family: Helping at Home","Setting the Table","Washing the Dishes (Simple)","Sweeping the Floor","Making My Bed","Being Responsible at Home","Revision and Examination"],
      ["First Aid at Home: Simple Cuts","Safety in the Kitchen","Review: Food and Clothing","Helping My Parents","Home Economics Fun: Make a Salad","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Home Economics",
    level: "primary", className: "Primary 2", subjectName: "Home Economics",
    description: "Home Economics for Primary 2 covering food preparation, clothing care and home management.",
    topics: terms(
      ["Food Groups: What We Eat and Why","Carbohydrates: Rice, Bread, Yam","Proteins: Beans, Eggs, Meat","Fruits and Vegetables: Daily Needs","Water: How Much We Need","Cooking Methods: Boiling and Frying","Preparing a Simple Salad","Preparing Fruit Juice","Table Setting: Plate, Cup, Spoon","Meal Times: Breakfast, Lunch, Dinner","Food Hygiene: Washing Food","Revision and Examination"],
      ["Types of Fabric: Cotton and Polyester","Sewing Needles and Thread","Simple Hand Stitches: Running Stitch","Sewing a Button","Caring for Clothes: Washing","Ironing Safely (With Help)","Types of Houses: Bungalow, Flat","Rooms in the House: Parlour, Bedroom","Household Pests: Cockroach, Rat","Pest Control: Simple Methods","Cleaning Products: Safe Use","Revision and Examination"],
      ["Family Roles: Father, Mother, Children","Helping with Chores","Simple Budget: Spending Wisely","Home Economics Project: Cook a Meal","Review: Food and Home","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Home Economics",
    level: "primary", className: "Primary 3", subjectName: "Home Economics",
    description: "Home Economics for Primary 3 covering cooking methods, clothing construction and home care.",
    topics: terms(
      ["Nutrient Content of Foods: Vitamins","Mineral Sources: Iron and Calcium","Balanced Diet: Planning a Day's Meals","Special Diets: For Sick People","Food Preservation: Drying","Food Preservation: Refrigeration","Nigerian Dishes: Jollof Rice","Nigerian Dishes: Egusi Soup","Nigerian Dishes: Pounded Yam","Making a Simple Snack: Chin-Chin","Kitchen Hygiene: Cleaning Utensils","Revision and Examination"],
      ["Fabric Types: Natural and Synthetic","Measuring for Clothing: Tape Measure","Pattern Making: Simple Tracing","Cutting Fabric Safely","Running Stitch and Backstitch","Making a Simple Bag","Appliqué: Sewing Shapes","Mending Clothes: Fixing a Tear","Laundry: Soaking and Scrubbing","Stain Removal: Basic Methods","Ironing: Temperature Settings","Revision and Examination"],
      ["Home Decoration: Simple Ideas","Flower Arrangements","Interior Cleanliness","Review: Food and Clothing","Home Economics Fair","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Home Economics",
    level: "primary", className: "Primary 4", subjectName: "Home Economics",
    description: "Home Economics for Primary 4 covering nutrition, food science and garment making.",
    topics: terms(
      ["Macro and Micronutrients: Review","Deficiency Diseases: Kwashiorkor, Rickets","Food Fortification: Adding Vitamins","Food Standards: NAFDAC Labels","Reading Food Labels","Allergies: Common Food Allergies","Meal Planning: A Week's Menu","Catering: Serving Food","Tea and Beverage Preparation","Baking: Simple Biscuits","Confectionery: Sweets and Candy","Revision and Examination"],
      ["Sewing Machine: Parts and Threading","Machine Stitches: Straight and Zigzag","Seams: Plain Seam","Making an Apron: Step by Step","Embroidery: Chain Stitch","Knitting: Basic Stitch (Introduction)","Consumer Education: Best Value for Money","Budgeting for the Family","Savings and Family Finance","Child Care: Baby Bath Demonstration","Child Nutrition: Complementary Feeding","Revision and Examination"],
      ["Interior Design: Colour and Light","Housing Rental: Simple Concepts","Home Management: Planning","Review: Nutrition and Sewing","Home Economics Project: Sew an Item","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Home Economics",
    level: "primary", className: "Primary 5", subjectName: "Home Economics",
    description: "Home Economics for Primary 5 covering food science, fashion and home management.",
    topics: terms(
      ["Food Science: Enzymes in Food","Food Fermentation: Ogi, Locust Bean","Dehydration: Drying Fruits and Vegetables","Food Packaging: Materials","Food Safety: HACCP Simplified","Advanced Cooking: Continental Dishes","Nigerian Cuisine: Regional Varieties","Catering Business: Starting Out","Recipe Writing: Format","Menu Costing: Simple Calculation","Food Business: Pricing and Profit","Revision and Examination"],
      ["Fashion Design: Basic Concepts","Garment Patterns: Drafting a Skirt","Fabric Shopping: Types and Cost","Making a Skirt: Step by Step","Zip and Buttons: Insertion","Hem Finishing: Blind Hem","Tie and Dye: Nigerian Tradition","Batik: Wax-Resist Dyeing","Consumer Rights: Returning Goods","Home Budget: Monthly Expenses","Family Finance: Saving and Investing","Revision and Examination"],
      ["Home Economics Careers: Chef, Designer","Entrepreneurship in Home Economics","Home Economics Project: Business Plan","Review: Food and Clothing","FSLC Preparation: Home Economics","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Home Economics",
    level: "primary", className: "Primary 6", subjectName: "Home Economics",
    description: "Home Economics for Primary 6 with FSLC preparation.",
    topics: terms(
      ["Home Economics Review: Nutrition","Food Preparation Review","Food Science Review","Clothing and Textiles Review","Sewing and Embroidery Review","Home Management Review","Child Development Review","Family Finance Review","Consumer Education Review","Catering Review","Career in Home Economics Review","Revision and Examination"],
      ["FSLC Home Economics: Objectives","FSLC Home Economics: Theory","Past Questions Practice","Practical Cooking Assessment","Sewing Project Review","Mock Examination","Examination Techniques","Portfolio Review","Home Economics Exhibition","Community Cooking Project","Nutrition Campaign","Revision and Examination"],
      ["Final Revision: Nutrition","Final Revision: Clothing","Final Revision: Home Management","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  CULTURAL AND CREATIVE ARTS — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Cultural and Creative Arts",
    level: "primary", className: "Primary 1", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 1: drawing, colouring, music, drama and crafts.",
    topics: terms(
      ["Introduction to Art: What Is Art?","Colours: Primary Colours","Mixing Colours: Secondary Colours","Drawing Lines: Straight and Curved","Drawing Simple Shapes: Circle, Square","Drawing Animals: Simple Sketches","Colouring: Using Crayons Neatly","Craft: Paper Folding – Boat and Hat","Craft: Paper Cutting – Simple Shapes","Clay Modelling: Ball and Snake","Drawing My Family","Revision and Examination"],
      ["Music: Clapping Rhythms","Music: Singing Nigerian Nursery Rhymes","Music: High and Low Sounds","Musical Instruments: Drum, Bell, Shaker","Drama: Role Play – My Family","Drama: Animal Sounds Role Play","Dance: Simple Nigerian Dance Steps","Craft: Collage with Paper","Making a Greeting Card","Drawing: My Home","Nigerian Festivals: Drawing","Revision and Examination"],
      ["Puppet Making: Paper Puppet","Mask Making: Simple Mask","Nigerian Patterns: Drawing","Storytelling Through Art","Art Exhibition: Display My Work","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Cultural and Creative Arts",
    level: "primary", className: "Primary 2", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 2 advancing drawing, painting, drama and Nigerian heritage.",
    topics: terms(
      ["Colour Wheel: All Colours","Warm and Cool Colours","Drawing: Still Life – Fruits","Painting: Watercolour Basics","Printing: Leaf Printing","Printing: Sponge Printing","Craft: Paper Weaving","Craft: Bead Stringing – Simple Jewellery","Drawing: Nigerian Traditional Costume","Carving: Soap Carving (Simple)","Collage: Magazine Collage","Revision and Examination"],
      ["Music: Sol-Fa Notation (Introduction)","Music: Do Re Mi Fa Sol","Singing: Nigerian Patriotic Songs","Musical Instruments: Talking Drum","Dance: Bata Dance Introduction","Drama: Short Play – School Life","Improvisation: Making Up a Story","Storytelling: Nigerian Folktales","Puppet Show: Simple Performance","Yoruba Art: Adire Pattern","Igbo Art: Uli Pattern","Revision and Examination"],
      ["Nigerian Art Forms: Overview","Making a Traditional Necklace","Drawing: Nigerian Landmark","Art Exhibition: Group Display","Appreciation: Looking at Art","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Cultural and Creative Arts",
    level: "primary", className: "Primary 3", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 3 covering perspective, drama, music theory and crafts.",
    topics: terms(
      ["Elements of Art: Line, Shape, Colour, Texture","Proportion: Making Things the Right Size","Drawing: Perspective – Horizon Line","Painting: Poster Paint Techniques","Batik: Simple Wax and Dye","Tie-Dye: Folding and Dipping","Pottery: Hand Building","Sculpture: Wire Sculpture","Mosaic: Torn Paper Mosaic","Drawing: Map of Nigeria","Nigerian Crafts: Basket Weaving","Revision and Examination"],
      ["Music Theory: Quarter and Half Notes","Rhythm: Clapping Patterns","Singing: Two-Part Harmony","Recorder: Introduction (Optional)","Dance: Traditional Dances of Nigeria","Dance: Ekombi and Swange","Drama: Play Script Reading","Drama: Performing a Short Scene","Stage Design: Simple Set","Costume Design: Sketching","Make-Up for Drama: Simple","Revision and Examination"],
      ["Film and Photography: Simple Concepts","Digital Art: Painting on a Tablet","Nigerian Artists: Famous Names","Art Criticism: Talking About Art","Art Exhibition: Plan and Mount","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Cultural and Creative Arts",
    level: "primary", className: "Primary 4", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 4 with advanced techniques and cultural appreciation.",
    topics: terms(
      ["Art History: Ancient Nigerian Civilisations","Nok Terracotta: History and Significance","Ife Bronzes: History and Art","Benin Bronzes: History and Art","Drawing: Life Drawing – Simple Figures","Oil Pastel Techniques","Acrylic Painting: Introduction","Sculpture: Plaster of Paris","Graphic Design: Simple Poster","Photography: Composition Rules","Digital Design: Simple Logo","Revision and Examination"],
      ["Music Theory: Time Signatures","Singing: Three-Part Choir","Traditional Music: Nigerian Genres","Afrobeats: Origin and Style","Dance Choreography: Simple Routine","Drama: One-Act Play Writing","Acting Techniques: Voice and Movement","Stage Lighting: Introduction","Set Construction: Simple Backdrop","Sound Effects in Drama","Drama Performance","Revision and Examination"],
      ["Contemporary Nigerian Art","Street Art and Graffiti","Art in Society: Community Murals","Review: Art Techniques","Art Fair: Present Your Work","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Cultural and Creative Arts",
    level: "primary", className: "Primary 5", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 5 covering design, production and cultural heritage.",
    topics: terms(
      ["Advanced Drawing: Realistic Portraits","Advanced Painting: Mixed Media","Printmaking: Etching (Simple)","Installation Art: Concept","Video Art: Simple Video Making","Graphic Novel: Creating a Comic Strip","Typography: Lettering and Fonts","Packaging Design: Designing a Box","Interior Design Sketching","Architectural Drawing: My Dream House","Product Design: Simple Concepts","Revision and Examination"],
      ["Music Production: Simple Beat Making","Music Technology: Using a DAW (Simple)","Song Writing: Simple Lyrics","Choir Direction: Conducting","World Music: Comparing Nigerian and Western","Dance: Contemporary Choreography","Drama: Community Theatre","Documentary Making: Plan and Film","Animation: Flip Book","Digital Storytelling","Media Literacy: Reading Images","Revision and Examination"],
      ["Nigerian Heritage Sites: Art and Culture","Cultural Preservation: Our Responsibility","Arts Entrepreneurship: Selling Art","Review: Across All Art Forms","Portfolio Creation","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Cultural and Creative Arts",
    level: "primary", className: "Primary 6", subjectName: "Cultural and Creative Arts",
    description: "Cultural and Creative Arts for Primary 6 with FSLC preparation and portfolio development.",
    topics: terms(
      ["Art Review: Drawing and Painting","Art Review: Sculpture and Craft","Art Review: Graphics","Music Review: Theory and Practice","Dance Review: Nigerian Dances","Drama Review: Performance Skills","Nigerian Heritage Review","Contemporary Arts Review","Digital Arts Review","Art Appreciation Review","Portfolio Review","Revision and Examination"],
      ["FSLC CCA: Objectives Practice","Theory Questions","Past Questions Practice","Group Drama Performance","Art Exhibition","Mock Examination","Final Portfolio Review","Artist Statement Writing","Examination Techniques","Cultural Heritage Project","Oral Presentation of Art","Revision and Examination"],
      ["Final Revision: Visual Arts","Final Revision: Music and Dance","Final Revision: Drama","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  MUSIC — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Music",
    level: "primary", className: "Primary 1", subjectName: "Music",
    description: "Music for Primary 1: singing, rhythm, musical instruments and listening skills.",
    topics: terms(
      ["Introduction to Music: What Is Music?","Sounds Around Us: Loud and Soft","High and Low Sounds","Long and Short Sounds","Rhythm: Clapping to a Beat","Singing: Nigerian Nursery Rhymes","Singing: National Anthem","Musical Instruments: Drums","Musical Instruments: Bells and Shakers","Singing: Action Songs","Music and Movement","Revision and Examination"],
      ["Melody: Simple Tunes","Do Re Mi: Introduction to Sol-Fa","Singing in Groups: Chorus","Listening: Identifying Instruments","African Instruments: Talking Drum","Creating Sounds: Body Percussion","Simple Songs: Two-Line Songs","Songs About Nature","Songs About Family","Cultural Songs: Nigerian Folk Songs","Music and Celebration","Revision and Examination"],
      ["Percussion: Playing Simple Rhythms","Music and Dance Together","Creating a Simple Song","Favourite Songs: Singing Together","Music Performance","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Music",
    level: "primary", className: "Primary 2", subjectName: "Music",
    description: "Music for Primary 2 covering notes, rhythm, singing in parts and Nigerian music.",
    topics: terms(
      ["Music Notation: Notes – Semibreve, Minim","Music Notation: Crotchet and Quaver","Writing Notes on a Staff","Treble Clef: Drawing and Purpose","Bar Lines and Time Signatures (Simple)","Rhythm: Clapping Written Rhythms","Pitch: Sol-Fa – Do Re Mi Fa Sol","Singing: Simple Melodies","Rounds and Canons: Introduction","Songs in Two Parts","Dynamics: Loud and Soft in Music","Revision and Examination"],
      ["Tempo: Fast and Slow Music","Mood in Music: Happy and Sad","Nigerian Folk Songs: Yoruba","Nigerian Folk Songs: Igbo","Nigerian Folk Songs: Hausa","African Percussion: Patterns","Making Instruments: Shaker Bottle","Making Instruments: Drum","Playing Together: Small Ensemble","Musical Performance: Solo","Music Listening: Describing What We Hear","Revision and Examination"],
      ["Music Composition: Simple Melody","Writing a Short Song","Music and Storytelling","Review: Notes and Rhythm","Music Concert: Class Performance","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Music",
    level: "primary", className: "Primary 3", subjectName: "Music",
    description: "Music for Primary 3 covering music theory, scales, harmony and cultural music.",
    topics: terms(
      ["Staff Notation: Notes and Rests","Time Signature: 2/4, 3/4, 4/4","Major Scale: C Major","Sol-Fa: Full Octave","Interval: Steps and Leaps","Harmony: Two Notes Together","Chord: Major Chord (Simple)","Key Signatures: Introduction","Transposition: Moving a Melody (Simple)","Singing: Three-Part Harmony","Sight Singing: Simple Exercises","Revision and Examination"],
      ["World Music: African Music","World Music: Western Classical","Music in Nigeria: Traditional Genres","Music in Nigeria: Contemporary – Jùjú","Music in Nigeria: Afrobeats","Instruments: String Family","Instruments: Wind Family","Instruments: Keyboard – Piano (Simple)","Recorder: Basic Notes (Optional)","Music and Religion: Worship Songs","Music and Ceremony: Weddings, Funerals","Revision and Examination"],
      ["Music Criticism: Reviewing a Song","Composing: Writing a Short Piece","Music Technology: Using an App","Music Performance: Ensemble","Music Concert Preparation","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Music",
    level: "primary", className: "Primary 4", subjectName: "Music",
    description: "Music for Primary 4 advancing theory, composition, and world music appreciation.",
    topics: terms(
      ["Music Theory: Advanced Notes","Triplets and Dotted Notes","Minor Scale: A Minor","Key Signatures: Sharps and Flats","Aural Training: Dictation","Sight Reading: Simple Exercises","Part-Singing: SATB (Introduction)","Choral Music: Arranging","Composition: Simple Song with Chords","Harmonising a Melody","Music from Written Score","Revision and Examination"],
      ["Music History: Ancient Music","Renaissance Music: Introduction","Baroque Music: Bach (Simple)","Classical Period: Mozart","Romantic Period: Beethoven (Simple)","African Music History","Nigerian Music History: Pre-Colonial","Fela Kuti: Afrobeat Pioneer","King Sunny Ade: Jùjú Music","Burna Boy: Contemporary Afrobeats","Music Business: Simple Concepts","Revision and Examination"],
      ["Composing: Two-Verse Song","Music Technology: Recording a Sound","Genre Exploration: Jazz, Pop, Classical","Review: Music Theory","Music Performance Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Music",
    level: "primary", className: "Primary 5", subjectName: "Music",
    description: "Music for Primary 5 with advanced composition, performance and music industry overview.",
    topics: terms(
      ["Advanced Music Theory: Modes","Modulation: Changing Key","Form in Music: Binary and Ternary","Sonata Form: Introduction","Counterpoint: Two Melodies","Advanced Chords: Seventh Chords","Music Arranging: Simple Score","Orchestration: Assigning Instruments","Composition Project: Instrumental Piece","Notation Software: Finale or MuseScore (Simple)","Music Portfolio: Building It","Revision and Examination"],
      ["Music Industry: Record Labels","Music Production: Beats and Tracks","Music Copyright: Protecting Your Work","Streaming: How Spotify and Apple Music Work","Live Music: Concerts and Tours","Music and Film: Soundtracks","Music and Advertising: Jingles","Radio: How Music Is Played","Music Journalism: Writing Reviews","Interview a Musician (Project)","Music Career Pathways","Revision and Examination"],
      ["Music and Culture: Preserving Heritage","Music Collaboration: Group Composition","Music Festival Planning","Review: Theory and Performance","Final Portfolio","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Music",
    level: "primary", className: "Primary 6", subjectName: "Music",
    description: "Music for Primary 6 with FSLC preparation and comprehensive music review.",
    topics: terms(
      ["Music Theory Review: Notes and Rests","Rhythm Review","Scales and Keys Review","Harmony Review","Music History Review","Nigerian Music Review","World Music Review","Music Performance Review","Composition Review","Music Technology Review","Careers in Music Review","Revision and Examination"],
      ["FSLC Music: Objectives Practice","Theory Questions","Aural Test Practice","Performance Assessment","Composition Review","Past Questions Practice","Mock Examination","Music Portfolio Presentation","Concert: Final Performance","Music in Society","Examination Techniques","Revision and Examination"],
      ["Final Revision: Theory","Final Revision: Performance","Final Revision: History and Culture","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  FINE ARTS — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Fine Arts",
    level: "primary", className: "Primary 1", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 1: basic drawing, colouring, shapes and simple craftwork.",
    topics: terms(
      ["What Is Fine Art?","Drawing with Pencil: Lines","Drawing with Pencil: Shapes","Colouring: Using Crayons","Primary Colours: Red, Blue, Yellow","Mixing Colours: Green, Orange, Purple","Drawing Animals: Cat and Dog","Drawing Plants: Tree and Flower","Drawing People: Simple Stick Figure","Clay: Rolling and Shaping","Printing: Potato Print","Revision and Examination"],
      ["Tearing and Pasting: Collage","Drawing My School","Painting with Fingers","Sponge Painting","Blowing Paint: Drip Art","Wax-Resist Painting","Drawing My Favourite Food","Drawing Vehicles: Car and Bus","Drawing Houses","Nature Drawing: Leaf and Flower","Pattern Making: Dots and Stripes","Revision and Examination"],
      ["Making a Birthday Card","Gift Wrapping Decoration","Drawing: My Self-Portrait","Colour My World: Free Painting","Art Show: My Best Work","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Fine Arts",
    level: "primary", className: "Primary 2", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 2 advancing drawing skills, painting and craft techniques.",
    topics: terms(
      ["Colour Theory: Warm and Cool Colours","Tints and Shades: Adding White and Black","Drawing: Observation of Objects","Still Life Drawing: Fruit Bowl","Painting: Brush Techniques","Watercolour: Wash Techniques","Pastel: Blending","Charcoal Drawing: Introduction","Printmaking: Leaf and Sponge","Mono Print: Simple","Stencilling: Creating Patterns","Revision and Examination"],
      ["Sculpture: Pinch Pot (Clay)","Sculpture: Coil Pot (Clay)","Paper Sculpture: 3D Forms","Found Object Art: Nature Collection","Mosaic: Paper Tiles","Weaving: Paper Strips","Origami: Simple Birds and Animals","Collage: Magazine and Fabric","Textile Art: Simple Stitching","Batik: Wax and Dye on Paper","Drawing Nigerian Animals","Revision and Examination"],
      ["Art Appreciation: Looking at Famous Art","Drawing: Nigerian Cultural Scene","Portrait Drawing: My Friend","Landscape Drawing: My Village","Art Exhibition: Display Proudly","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Fine Arts",
    level: "primary", className: "Primary 3", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 3 covering art elements, Nigerian art history and 3D work.",
    topics: terms(
      ["Elements of Art: Line, Shape, Form","Elements of Art: Colour, Texture, Space","Principles of Art: Balance and Rhythm","Drawing: Perspective Basics","Drawing: Still Life – Advanced","Painting: Acrylic Techniques","Painting: Mixed Media","Illustration: Book Cover Design","Poster Art: Simple Posters","Graphic Design: Logos and Signs","Pattern Design: Nigerian Patterns","Revision and Examination"],
      ["Nigerian Art History: Nok Terracotta","Nigerian Art History: Ife Naturalism","Nigerian Art History: Benin Kingdom","African Textile Art: Kente and Aso-Oke","Pottery: Wheel Technique (Introduction)","Ceramic Decoration: Slip and Glaze","Relief Sculpture: Clay","Found Object Sculpture","Mobile: Hanging Sculpture","Photography: Composition","Digital Art: Drawing on a Device","Revision and Examination"],
      ["Art Criticism: Analyse a Painting","Art as Communication","Environmental Art: Eco-Friendly Materials","Review: 2D and 3D Art","Art Exhibition and Awards","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Fine Arts",
    level: "primary", className: "Primary 4", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 4 covering advanced media, world art history and design.",
    topics: terms(
      ["Advanced Drawing: Light and Shadow","Realistic Drawing: Human Face","Perspective: One-Point Perspective","Perspective: Two-Point Perspective","Oil Pastel: Advanced Techniques","Acrylic: Layering and Glazing","Printmaking: Relief Print","Printmaking: Screen Print (Simple)","Illustration: Children's Book Page","Cartooning: Comic Characters","Animation Concept: Flip Book","Revision and Examination"],
      ["World Art History: Egyptian Art","World Art History: Greek Art","World Art History: Renaissance","Impressionism: Monet Style","Abstract Art: Kandinsky Style","Pop Art: Warhol Style","African Contemporary Art","Installation Art: Planning","Street Art: Murals and Graffiti","Photography: Lighting and Angles","Video Art: Simple Clip","Revision and Examination"],
      ["Design Thinking: Problem Solving with Art","Fashion Illustration: Dress Sketch","Interior Design Mood Board","Review: Art History","Gallery Visit Report","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Fine Arts",
    level: "primary", className: "Primary 5", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 5 with portfolio development, advanced techniques and art careers.",
    topics: terms(
      ["Figurative Art: Human Anatomy Drawing","Animal Anatomy Drawing","Landscape Painting: Advanced","Abstract Expressionism: Free Painting","Mixed Media: Combining Techniques","Printmaking: Etching Techniques","Sculpture: Armature and Clay","Digital Art: Vector Graphics","Graphic Design: Brand Identity","Typography: Lettering Art","Photography: Portrait Session","Revision and Examination"],
      ["Art and Society: Art as Protest","Art and Culture: Preserving Heritage","Community Art: Public Murals","Art and Commerce: Selling Art","Art Exhibition Planning","Artist Statement Writing","Curating an Exhibition","Reviewing an Exhibition","Art in Media: Movies and Advertising","Art in Architecture","Career Paths in Fine Arts","Revision and Examination"],
      ["Portfolio Compilation","Artist Talk: Present Your Work","Reflection: Art Journey","Review: All Techniques","Fine Arts Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Fine Arts",
    level: "primary", className: "Primary 6", subjectName: "Fine Arts",
    description: "Fine Arts for Primary 6 with FSLC preparation and final portfolio.",
    topics: terms(
      ["Fine Arts Review: Drawing Techniques","Fine Arts Review: Painting","Fine Arts Review: Sculpture","Fine Arts Review: Crafts","Fine Arts Review: Design","Fine Arts Review: Art History","Fine Arts Review: Nigerian Art","Fine Arts Review: Photography","Fine Arts Review: Digital Art","Portfolio Review: Selection","Artist Statement Review","Revision and Examination"],
      ["FSLC Fine Arts: Objectives","Theory Questions","Practical Assessment","Art Project: Final Piece","Past Questions Practice","Mock Examination","Exhibition Planning","Gallery Walk","Examination Techniques","Portfolio Presentation","Peer Review","Revision and Examination"],
      ["Final Revision: 2D Art","Final Revision: 3D Art","Final Revision: Art History","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  CHRISTIAN RELIGIOUS STUDIES (CRS) — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Christian Religious Studies",
    level: "primary", className: "Primary 1", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 1 covering God's creation, family, Bible stories and Christian values.",
    topics: terms(
      ["God Made Me: I Am Special","God Made the World (Genesis 1)","Day and Night: God's Plan","Animals God Made","Plants God Made","The Family: God's Gift","Obedience: Obeying Parents","Love: Loving One Another","Prayer: Talking to God","The Lord's Prayer (Matthew 6)","Going to Church: Why We Worship","Revision and Examination"],
      ["Adam and Eve (Genesis 2-3)","Noah and the Ark (Genesis 6-9)","Baby Moses: God's Protection (Exodus 2)","David and the Giant Goliath (1 Samuel 17)","Jesus Is Born (Luke 2)","Jesus Loves Children (Mark 10)","Jesus Feeds the People (Mark 6)","Jesus Heals the Sick (Luke 17)","Easter: Jesus Rose Again","Honesty: Telling the Truth","Sharing: Being Generous","Revision and Examination"],
      ["Christmas: Jesus Our Gift","Helping Others: The Good Samaritan (Simple)","God Protects Me","Saying Sorry: Asking for Forgiveness","Being a Good Friend","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Christian Religious Studies",
    level: "primary", className: "Primary 2", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 2 advancing Bible stories, the Ten Commandments and Christian living.",
    topics: terms(
      ["The Bible: Old and New Testament","Creation Story Review","Abraham Obeys God (Genesis 12)","Lot and Sodom (Genesis 18-19)","Isaac: God's Promise (Genesis 21)","Jacob and Esau (Genesis 25)","Joseph Forgives His Brothers (Genesis 45)","Moses: The Burning Bush (Exodus 3)","The Ten Commandments (Exodus 20)","Crossing the Red Sea (Exodus 14)","Joshua and Jericho (Joshua 6)","Revision and Examination"],
      ["Ruth: Loyalty (Ruth 1)","Samuel Serves God (1 Samuel 3)","Saul: First King of Israel","David: Chosen by God (1 Samuel 16)","Elijah and the Rain (1 Kings 18)","The Birth of Jesus Review","Jesus' Childhood in Nazareth","The Beatitudes: Blessed Are... (Matthew 5)","Jesus and Zacchaeus (Luke 19)","The Prodigal Son (Luke 15)","The Last Supper","Revision and Examination"],
      ["Easter: Death and Resurrection","Pentecost: Holy Spirit Comes","Loving My Neighbour","Gratitude: Thanking God","Christian Values: Honesty and Kindness","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Christian Religious Studies",
    level: "primary", className: "Primary 3", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 3 covering the Psalms, wisdom books, Jesus' miracles and prayer.",
    topics: terms(
      ["The Psalms: Songs of Praise (Psalm 23)","Psalm 91: God's Protection","Proverbs: Wisdom for Living","Solomon: The Wisest King","Jonah: Obedience to God","Daniel in the Lions' Den (Daniel 6)","Shadrach, Meshach, Abednego (Daniel 3)","Nehemiah: Rebuilding the Walls","Esther: Courage (Esther 4-5)","The Prophets: Isaiah and Jeremiah (Simple)","Prophecies About Jesus","Revision and Examination"],
      ["Jesus' Miracles: Water to Wine (John 2)","Jesus Heals the Blind (John 9)","Jesus Calms the Storm (Mark 4)","Jesus Raises Lazarus (John 11)","Parables: The Talents (Matthew 25)","Parables: Lost Sheep (Luke 15)","Parables: Mustard Seed (Matthew 13)","The Sermon on the Mount: Love Your Enemies","Forgiveness: 70 × 7 (Matthew 18)","The Lord's Prayer: Detailed Study","Fasting and Prayer","Revision and Examination"],
      ["The Early Church: Acts 2","Sharing and Generosity: Early Christians","Paul's Conversion (Acts 9)","Christian Values: Fruits of the Spirit","Review: Old and New Testament","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Christian Religious Studies",
    level: "primary", className: "Primary 4", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 4 covering advanced Old Testament, Jesus' teachings and the epistles.",
    topics: terms(
      ["The Creation: Theological Meaning","The Fall: Sin and Its Consequences","The Patriarchs: Abraham, Isaac, Jacob","The Exodus: Deliverance and Covenant","The Law: Importance for Israel","The Kingdom of Israel: Saul to Solomon","The Divided Kingdom","The Exile: Why It Happened","The Return: Ezra and Nehemiah","The Wisdom Literature: Job's Suffering","Malachi: Last Old Testament Prophet","Revision and Examination"],
      ["The Incarnation: God Became Man","Jesus' Ministry: Galilee and Jerusalem","Jesus' Transfiguration (Matthew 17)","Jesus and the Temple (Matthew 21)","The Passion: Arrest and Trial","Crucifixion: Meaning and Significance","Resurrection: Evidence","Ascension and Great Commission","The Holy Spirit: Person and Work","Gifts of the Spirit (1 Corinthians 12)","Fruit of the Spirit (Galatians 5)","Revision and Examination"],
      ["Christian Living: Love (1 Corinthians 13)","Stewardship: Caring for What God Gives","Prayer Types: Praise, Intercession","Service: Serving Others Like Jesus","Review: Jesus' Life and Teaching","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Christian Religious Studies",
    level: "primary", className: "Primary 5", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 5 covering church history, Paul's letters, social justice and faith.",
    topics: terms(
      ["The Church: Meaning and Purpose","Early Church Fathers","Persecution: Staying Faithful","Christianity Spreads to Africa","The Bible: How It Was Written","Canonisation: How Books Were Chosen","Bible Translation: Importance","Denominationalism: Different Churches","The Anglican Church in Nigeria","The Catholic Church in Nigeria","Pentecostal Movement in Nigeria","Revision and Examination"],
      ["Paul's Letter to the Romans: Key Themes","Galatians: Faith and Freedom","Ephesians: Unity in Christ","Philippians: Joy and Contentment","1 Corinthians: Church Problems and Solutions","Hebrews: Faith (Hebrews 11)","James: Practical Faith","1 Peter: Suffering and Hope","Social Justice: Christian Response to Poverty","Christians and Government: Romans 13","Environmental Stewardship","Revision and Examination"],
      ["Christianity and Other Religions","Interfaith Dialogue","Christian Citizenship","Review: Paul's Letters","CRS Project: Research a Christian Value","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Christian Religious Studies",
    level: "primary", className: "Primary 6", subjectName: "Christian Religious Studies",
    description: "CRS for Primary 6 with FSLC preparation across all CRS topics.",
    topics: terms(
      ["CRS Review: Old Testament","CRS Review: New Testament","CRS Review: The Church","CRS Review: Christian Ethics","CRS Review: Prayer and Worship","CRS Review: The Holy Spirit","CRS Review: Christian Living","CRS Review: Paul's Letters","CRS Review: Psalms and Proverbs","CRS Review: Parables of Jesus","CRS Review: Miracles of Jesus","Revision and Examination"],
      ["FSLC CRS: Objectives Practice","Theory Questions","Bible Knowledge Test","Past Questions Practice","Mock Examination","Christian Values Project","Church Visit Report","Bible Reading Plan","Examination Techniques","Portfolio Review","Christian Living Seminar","Revision and Examination"],
      ["Final Revision: Old Testament","Final Revision: New Testament","Final Revision: Christian Living","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  ISLAMIC RELIGIOUS STUDIES (IRS) — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Islamic Religious Studies",
    level: "primary", className: "Primary 1", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 1 introducing Allah, creation, the Prophet and Islamic manners.",
    topics: terms(
      ["Allah: Who Created Us","Allah's Names: Al-Rahman and Al-Raheem","The Quran: Our Holy Book","Surah Al-Fatiha: Learning and Meaning","Surah Al-Ikhlas: Learning and Meaning","The Prophet Muhammad (SAW): His Story","I Am a Muslim: What It Means","Pillars of Islam: The Five Pillars","Salat: How We Pray (Introduction)","Wudu: How to Purify Ourselves","Islamic Manners: Saying Bismillah","Revision and Examination"],
      ["Surah Al-Falaq: Learning","Surah An-Nas: Learning","Angels: Who They Are","Paradise and Hell: Simple","Islamic Manners: Eating and Drinking","Islamic Manners: Greeting (Assalamu Alaikum)","Islamic Manners: Respect for Parents","The Month of Ramadan","Eid-ul-Fitr: Celebration","Eid-ul-Adha: Story of Ibrahim","Zakat: Giving to the Poor","Revision and Examination"],
      ["Stories from the Quran: Adam","Stories from the Quran: Nuh (Noah)","Being Kind to Others","Telling the Truth","Allah Loves Clean Children","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Islamic Religious Studies",
    level: "primary", className: "Primary 2", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 2 covering Quran recitation, Prophet's life, prayer and Islamic values.",
    topics: terms(
      ["Quran: Al-Baqarah Introduction","Surah Al-Asr: Learning and Meaning","The Prophets: Ibrahim (Abraham)","The Prophets: Musa (Moses)","The Prophets: Isa (Jesus)","The Prophet Muhammad (SAW): His Character","The Hijra: Moving to Madinah","The Five Pillars: Shahada","The Five Pillars: Salat (Prayer Times)","The Five Pillars: Zakat (Charity)","The Five Pillars: Sawm (Fasting)","Revision and Examination"],
      ["The Five Pillars: Hajj (Pilgrimage)","The Six Articles of Faith","Belief in Allah","Belief in Angels","Belief in Holy Books","Belief in Prophets","Belief in the Day of Judgment","Belief in Divine Decree","The Quran: Importance and Care","Hadith: Simple Examples","Islamic Manners: In the Masjid","Revision and Examination"],
      ["Islamic Calendar: Hijri Calendar","Islamic Months: Ramadan and Dhul Hijjah","Islamic Months: Muharram and Rabi","Story: The Cave of Hira","Islamic Values: Patience","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Islamic Religious Studies",
    level: "primary", className: "Primary 3", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 3 covering Quran studies, Islamic history and moral development.",
    topics: terms(
      ["Quran: Tajweed – Basic Rules of Recitation","Makharij: Letters of Articulation (Simple)","Surah Ya-Sin: Introduction","Surah Al-Mulk: Introduction","Story of Prophet Yusuf (Joseph)","Story of Prophet Sulaiman (Solomon)","Story of Prophet Dawud (David)","Story of Prophet Idris (Enoch)","Story of Prophet Hud","Story of Prophet Salih","Story of Prophet Lut (Lot)","Revision and Examination"],
      ["The Makkan Period: Prophet's Early Life","The Madinan Period: Building the Ummah","The Battle of Badr","The Battle of Uhud","The Treaty of Hudaybiyya","The Conquest of Makkah","The Farewell Sermon","Khalifas: Abu Bakr, Umar","Khalifas: Uthman, Ali","Islamic Civilisation: Contributions","Muslim Scientists and Scholars","Revision and Examination"],
      ["Islamic Ethics: Truthfulness (Sidq)","Islamic Ethics: Trust (Amanah)","Islamic Ethics: Justice","Islamic Ethics: Brotherhood","Review: Prophets and History","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Islamic Religious Studies",
    level: "primary", className: "Primary 4", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 4 covering advanced Quran, fiqh, Islamic law and Muslim communities.",
    topics: terms(
      ["Quran: Memorisation – Juz Amma","Quran: Tafsir – Surah Al-Kahf (Simple)","Quran: Tafsir – Surah Yusuf","Hadith Collections: Bukhari and Muslim","40 Hadith: Nawawawi (Introduction)","Fiqh: Islamic Jurisprudence – Introduction","Fiqh: Taharah – Purity and Cleanliness","Fiqh: Types of Water","Fiqh: Wudu – Obligatory Acts","Fiqh: Ghusl – Full Ablution","Fiqh: Tayammum – Dry Ablution","Revision and Examination"],
      ["Fiqh: Salat – Conditions and Pillars","Fiqh: Salat – Voluntary Prayers","Fiqh: Salat – Friday Prayer (Jumu'ah)","Fiqh: Zakat – Nisab and Rates","Fiqh: Sawm – Rules of Fasting","Fiqh: Hajj – Pillars (Simple)","Islamic Finance: Riba (Interest) Prohibition","Halal and Haram: Food","Halal and Haram: Behaviour","Islamic Marriage: Introduction","Islamic Family Life","Revision and Examination"],
      ["Islamic Communities in Nigeria","The Growth of Islam in West Africa","Islam and Nigerian Culture","Islamic Values in Modern Society","Review: Fiqh and Quran","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Islamic Religious Studies",
    level: "primary", className: "Primary 5", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 5 covering advanced Islamic studies, jurisprudence and contemporary issues.",
    topics: terms(
      ["Quran: Tafsir – Surah Ar-Rahman","Quran: Tafsir – Surah Al-Waqiah","Quran Science: Ijaz al-Quran (Miracle)","Hadith: Classification – Sahih and Da'if","Fiqh: Advanced – Business Transactions","Fiqh: Inheritance – Simple Rules","Fiqh: Crimes and Punishments – Overview","Islamic Ethics: Husn Al-Khuluq (Good Character)","Ethics: Anger Management in Islam","Ethics: Patience (Sabr)","Ethics: Gratitude (Shukr)","Revision and Examination"],
      ["Islamic History: Umayyad Caliphate","Islamic History: Abbasid Caliphate","Islamic History: Ottoman Empire","Islamic History: Africa – Mali and Songhai","Islam and Science: Contributions","Islam and Medicine: Ibn Sina","Islam and Mathematics: Al-Khwarizmi","Islam and Astronomy","Islamic Art and Architecture","Sufism: Introduction","Muslim Unity: Ummah","Revision and Examination"],
      ["Contemporary Issues: Islam and Democracy","Islam and Human Rights","Environmental Responsibility in Islam","Islamic Charity: Waqf","Review: History and Ethics","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Islamic Religious Studies",
    level: "primary", className: "Primary 6", subjectName: "Islamic Religious Studies",
    description: "IRS for Primary 6 with FSLC preparation across all Islamic studies topics.",
    topics: terms(
      ["IRS Review: Quran and Hadith","IRS Review: Articles of Faith","IRS Review: Pillars of Islam","IRS Review: Fiqh","IRS Review: Prophets and Stories","IRS Review: Islamic History","IRS Review: Islamic Ethics","IRS Review: Islamic Civilisation","IRS Review: Islam in Nigeria","IRS Review: Contemporary Islam","Islamic Values Review","Revision and Examination"],
      ["FSLC IRS: Objectives Practice","Theory Questions","Quran Recitation Assessment","Hadith Knowledge Test","Past Questions Practice","Mock Examination","Islamic Project: My Muslim Community","Examination Techniques","Portfolio Review","Islamic Quiz Competition","Oral Assessment","Revision and Examination"],
      ["Final Revision: Quran and Fiqh","Final Revision: History and Prophets","Final Revision: Ethics","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  PHYSICAL AND HEALTH EDUCATION (PHE) — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Physical & Health Education",
    level: "primary", className: "Primary 1", subjectName: "Physical & Health Education",
    description: "PHE for Primary 1: basic body movements, games, hygiene and simple health education.",
    topics: terms(
      ["My Body: Parts and Functions","Personal Hygiene: Washing Hands","Personal Hygiene: Brushing Teeth","Personal Hygiene: Bathing Daily","Keeping My Clothes Clean","Rest and Sleep: Importance","Food and Health: Eating Well","Exercise: Why We Need to Move","Running: Simple Sprint","Jumping: Long Jump and High Jump","Throwing: Ball Throwing","Revision and Examination"],
      ["Team Games: Simple Tag Games","Ball Games: Catching and Throwing","Indigenous Games: Police and Thief","Indigenous Games: Ten-Ten","Skipping Rope: Simple Jumps","Balance: Standing on One Leg","Gymnastics: Simple Tumbling","Dance: Action Songs","Swimming Safety: Stay Away from Deep Water","First Aid: Getting Help","Community Health: Clean Surroundings","Revision and Examination"],
      ["Sports Day: Preparation","Simple Athletics: Running Race","Simple Athletics: Long Jump","Review: Hygiene and Health","Health Habits Chart","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Physical & Health Education",
    level: "primary", className: "Primary 2", subjectName: "Physical & Health Education",
    description: "PHE for Primary 2 covering games, fitness, nutrition and health habits.",
    topics: terms(
      ["Fitness: What It Means","Exercise Types: Aerobic and Strength","Warm-Up Exercises","Cool-Down Stretches","Athletics: Running – 60m Sprint","Athletics: Standing Long Jump","Athletics: Ball Throw","Football: Introduction and Basic Rules","Volleyball: Introduction","Badminton: Introduction","Simple Circuit Training","Revision and Examination"],
      ["Nutrition and Physical Performance","Hydration: Drinking Water During Exercise","Sleep and Recovery","Personal Hygiene During Exercise","Common Childhood Diseases: Malaria","Common Diseases: Typhoid","Common Diseases: Diarrhoea","Immunisation: Why It Saves Lives","First Aid: Minor Cuts","First Aid: Nose Bleeds","Safety on the Playground","Revision and Examination"],
      ["Sports Participation: Sportsmanship","Fair Play: Playing by the Rules","Team Spirit: Working Together","Review: Health and Fitness","Sports Day Participation","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Physical & Health Education",
    level: "primary", className: "Primary 3", subjectName: "Physical & Health Education",
    description: "PHE for Primary 3 covering athletics, team sports, reproductive health intro and first aid.",
    topics: terms(
      ["Physical Fitness Components: Flexibility","Physical Fitness: Endurance","Physical Fitness: Speed","Athletic Skills: 100m Sprint","Athletic Skills: 200m Running","Athletic Skills: High Jump","Athletic Skills: Shot Put (Light Ball)","Football: Dribbling and Passing","Basketball: Passing and Dribbling","Volleyball: Serving and Setting","Table Tennis: Grip and Stance","Revision and Examination"],
      ["Gymnastics: Forward Roll","Gymnastics: Cartwheel (Introduction)","Dance: Nigerian Cultural Dance","Dance: Aerobic Dance","Swimming: Water Safety","First Aid: Burns","First Aid: Sprains and Strains","Puberty: Introduction (Age Appropriate)","Growing Up: Emotional Changes","Relationships: Healthy Friendships","Drug Awareness: What to Avoid","Revision and Examination"],
      ["Sports Ethics: Respecting Opponents","Records and Performance Tracking","Environmental Health: Outdoor Exercise","Review: Sports and Health","Athletics Competition","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Physical & Health Education",
    level: "primary", className: "Primary 4", subjectName: "Physical & Health Education",
    description: "PHE for Primary 4 covering advanced sports, adolescent health and community health.",
    topics: terms(
      ["Advanced Fitness Training: FITT Principle","Strength Exercises: Push-Ups and Sit-Ups","Endurance: Running Longer Distances","Flexibility: Yoga Stretches","Athletics: Relay Race","Athletics: Triple Jump Introduction","Football: Tactics and Team Play","Basketball: Shooting and Lay-Up","Handball: Introduction","Cricket: Introduction","Swimming: Basic Strokes","Revision and Examination"],
      ["Nutrition: Energy Foods for Athletes","Weight Management: Healthy Weight","Mental Health: Stress and Sports","Adolescent Changes: Physical","Adolescent Changes: Emotional","HIV/AIDS: Introduction (Age Appropriate)","Sexually Transmitted Infections: Awareness","Family Life: Relationships","Drug Abuse: Effects on the Body","Alcohol: Why to Avoid","Smoking: Dangers","Revision and Examination"],
      ["Community Sports: Village Games","Sports Leadership: Captain's Role","Sports Injury Prevention","Review: Sports and Adolescent Health","School Sports Competition","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Physical & Health Education",
    level: "primary", className: "Primary 5", subjectName: "Physical & Health Education",
    description: "PHE for Primary 5 covering advanced fitness, sports science and health education.",
    topics: terms(
      ["Sports Science: How the Body Works","Skeletal System and Sports","Muscular System: Types of Muscles","Cardiovascular System: Heart Rate","Respiratory System: Breathing and Exercise","Training Methods: Interval Training","Training Methods: Circuit Training","Performance Goals: Setting Targets","Athletics: Advanced Field Events","Football: Advanced Tactics","Basketball: Competitive Play","Revision and Examination"],
      ["Swimming: Competitive Strokes","Gymnastics: Apparatus Work","Martial Arts: Introduction to Taekwondo","Sports Psychology: Confidence and Focus","Nutrition Planning for Athletes","Injury Prevention: Warm-Up Importance","First Aid: Fractures and Dislocations","Reproductive Health: Female Puberty","Reproductive Health: Male Puberty","Family Planning: Age Appropriate","HIV/AIDS Prevention: Abstinence","Revision and Examination"],
      ["Sports Administration: Planning Events","Sports Officials: Referee and Umpire","Career in Sports and Physical Education","Review: Sports Science and Health","Sports Day Planning Project","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Physical & Health Education",
    level: "primary", className: "Primary 6", subjectName: "Physical & Health Education",
    description: "PHE for Primary 6 with FSLC preparation and comprehensive health review.",
    topics: terms(
      ["PHE Review: Physical Fitness","PHE Review: Athletics","PHE Review: Team Sports","PHE Review: Gymnastics and Dance","PHE Review: Nutrition and Health","PHE Review: Adolescent Health","PHE Review: Diseases and Prevention","PHE Review: First Aid","PHE Review: Drug Education","PHE Review: Environmental Health","PHE Review: Sports Science","Revision and Examination"],
      ["FSLC PHE: Objectives Practice","Theory Questions","Practical Assessment: Athletics","Practical Assessment: Team Sports","Past Questions Practice","Mock Examination","Health Education Project","First Aid Drill","Sports Leadership","Examination Techniques","Portfolio Review","Revision and Examination"],
      ["Final Revision: Sports and Fitness","Final Revision: Health Education","Final Revision: First Aid","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  YORUBA — Primary 1–6 and JSS 1–3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Yoruba",
    level: "primary", className: "Primary 1", subjectName: "Yoruba",
    description: "Yoruba for Primary 1: alphabet, vowels, basic vocabulary and simple sentences.",
    topics: terms(
      ["Alfabeti Yoruba: Lẹta A–G","Alfabeti Yoruba: Lẹta H–M","Alfabeti Yoruba: Lẹta N–T","Alfabeti Yoruba: Lẹta U–Z","Ohun Abẹnu: A, E, Ẹ, I, O, Ọ, U","Kika: Awọn Ọrọ Kukuru","Sisọ: Ẹniti, Kini, Nibo","Ẹbí: Bàbá, Ìyá, Ẹgbọn","Ile-Ẹwé: Olùkọ, Àwọn Ọmọ","Awọ: Pupa, Funfun, Dudu","Kíkọ Lẹta: Vowel Sounds","Atunyẹwo ati Ìdánwò"],
      ["Ẹranko Ile: Ewúrẹ, Àgùntàn","Ẹranko Igbó: Kiniun, Erin","Oúnjẹ: Ìyán, Ẹwà, Iresi","Lílo Omi: Mimu, Wẹ, Dìná","Ọjọ Ose: Àìkú, Ajé...","Oṣù: January–December (Basic)","Ọkọ Ayọkẹlẹ","Ẹfọ ati Eso","Kíkọ Ọrọ Kukuru","Kọtẹnu: Ìdánilójú","Ijẹun Ni Ile","Atunyẹwo ati Ìdánwò"],
      ["Ìjókòó Àti Dìde","Ẹlẹwà: Awọ Ara","Ọrọ Yoruba: Ẹ Jẹ Ká Sọrọ","Kọ Gbólóhùn Kékeré","Atunyẹwo Gbogbo","Ìdánwò Ikẹhin","Ìdánwò"]
    ),
  },
  {
    title: "Primary 2 – Yoruba",
    level: "primary", className: "Primary 2", subjectName: "Yoruba",
    description: "Yoruba for Primary 2 advancing grammar, reading, writing and Yoruba culture.",
    topics: terms(
      ["Fawẹli ati Kọnsonanti","Toni Ede Yoruba: Ìtẹ̀wọ̀npọ̀","Toni: Tẹlẹ, Aárín, Àgbà","Orúkọ: Eniyan, Ẹranko, Nǹkan","Ọrọ Apéjọ: Awọn, Díẹ","Ọrọ Ìsọ: Jẹun, Sùn, Jókòó","Àpèjúwe: Gbígbóná, Tútù","Gbólóhùn: Alaye ati Ibeere","Kọ Gbólóhùn Rẹ Funrara Rẹ","Ọrọ Atẹgun: Pẹlu, Ati, Sugbon","Àkọsílẹ: Kọ Ìtàn Kukuru","Atunyẹwo ati Ìdánwò"],
      ["Ìtàn Yoruba: Ìtàn Ìjíní","Owe Yoruba: Àwọn Owe","Ìbéèrè ati Ìdáhùn","Fáfá: Ede Yoruba nínú Ẹbí","Àkọlé: Kọ Lẹta si Ore","Kika Àsà Yoruba","Oriki: Iyin Orúkọ","Ijó Yoruba: Yoruba Dance Introduction","Orin Yoruba: Nigerian Folk Songs","Oṣù Yoruba: Osu Ọpẹ","Ọjọ Ìbímọ: Happy Birthday in Yoruba","Atunyẹwo ati Ìdánwò"],
      ["Yoruba ni Aye Oni","Kika Ìtàn Gígùn","Kọ Ìtàn Ara Rẹ","Àyẹwo Gbólóhùn","Atunyẹwo Gbogbo","Ìdánwò Ikẹhin","Ìdánwò"]
    ),
  },
  {
    title: "Primary 3 – Yoruba",
    level: "primary", className: "Primary 3", subjectName: "Yoruba",
    description: "Yoruba for Primary 3 covering grammar rules, composition and Yoruba traditions.",
    topics: terms(
      ["Ìsọrọ Ọrọ: Noun Classes","Ọrọ Ìsọ Àsìkò: Present and Past Tense","Ọrọ Ìsọ Ọjọ Iwájú","Àpẹjúwe: Adjectives in Yoruba","Ìfilọlẹ: Adverbs","Àpéjọ: Plural Forms","Ìpinnu: Questions with Kini, Ta, Nibo","Àkọsílẹ: Composition Writing","Kọ Lẹta Ìbáramu: Formal Letter","Ẹbí nínú Yoruba: Family Terms","Ìmọ Àṣà Yoruba: Marriage Customs","Atunyẹwo ati Ìdánwò"],
      ["Ìtàn Ọlọrun: Yoruba Myths","Owe Yoruba: Proverbs and Meanings","Àlọ: Riddles in Yoruba","Àṣà Ìsìn: Yoruba Traditional Religion (Cultural)","Odun: Yoruba Festivals","Orin Ayọ: Songs of Joy","Kika Iwe: Reading a Short Story","Ìfọrọwánilẹjẹ: Interview Practice","Ijẹun Yoruba: Traditional Dishes","Aṣọ Yoruba: Traditional Clothing","Ilé Yoruba: Traditional Architecture","Atunyẹwo ati Ìdánwò"],
      ["Yoruba nínú Ẹkọ: Importance","Ede Yoruba nínú Iṣé","Kika Ìwé Yoruba","Àyẹwo Ìmọ Ede","Atunyẹwo Gbogbo","Ìdánwò Ikẹhin","Ìdánwò"]
    ),
  },
  {
    title: "Primary 4 – Yoruba",
    level: "primary", className: "Primary 4", subjectName: "Yoruba",
    description: "Yoruba for Primary 4 advancing to intermediate grammar, literature and cultural studies.",
    topics: terms(
      ["Yoruba Phonology: Tonal Pairs","Morphology: Word Formation","Derivation: Prefix and Suffix in Yoruba","Àpẹẹrẹ Orúkọ: Common and Proper Nouns","Sentences: Complex Structures","Discourse: Paragraph Writing","Kọ Ìtàn Gíga: Narrative Composition","Ìfọrọwánilẹjẹ: Oral Interview","Àkọsílẹ Alaye: Expository Writing","Àkọsílẹ Ìdáhùn: Argumentative Yoruba","Àkọjọ Ẹsẹ: Poetry Writing","Atunyẹwo ati Ìdánwò"],
      ["Yoruba Oral Literature: Epic Poetry","D.O. Fagunwa: Introduction to His Work","Ìtàn Igbo Olodumare","Owe ati Àlọ: Advanced","Yoruba Proverbs in Daily Life","Yoruba History: Oduduwa Tradition","Kingdoms: Oyo, Ife, Ijesa","Yoruba Diaspora: Cuba, Brazil, USA","Yoruba in the Modern World","Yoruba Language on Social Media","Preservation of Yoruba Language","Atunyẹwo ati Ìdánwò"],
      ["FSLC Yoruba: Ẹkọ Àtúnyẹwò","Kika Ìtàn Gigun","Àkọsílẹ Ìtàn","Àyẹwo Ẹsẹ Orin","Atunyẹwo Gbogbo","Ìdánwò Ikẹhin","Ìdánwò"]
    ),
  },
  {
    title: "Primary 5 – Yoruba",
    level: "primary", className: "Primary 5", subjectName: "Yoruba",
    description: "Yoruba for Primary 5 with advanced literature, oral skills and FSLC preparation.",
    topics: terms(
      ["Àṣà Ede Yoruba: Language Contact","Code Switching: Yoruba and English","Register in Yoruba: Formal and Informal","Àkàndé Orisun: Oral History","Yoruba Literature: Types","Ewì (Poetry): Analysis","Àlọ Àpàmọ (Riddles): Advanced","Àlọ Àgbékàlẹ (Folktales): Analysis","Ẹkọ ìwé Olókunkun: Novel Study","Composition: Letter to My Governor","Ọrọ Lórí Ìbẹrẹ Igba Ọjọ-Iwaju","Atunyẹwo ati Ìdánwò"],
      ["Yoruba and the National Question","Minority Languages and Yoruba","Yoruba Diaspora Writers","Ǎkàndé Kolawole: Nigerian Author","Wole Soyinka: Brief Introduction","Fela Kuti: Yoruba in Music","Yoruba in Nollywood","Yoruba Computing: Keyboard Layouts","Yoruba Wikipedia: Contribution","Youth and Yoruba Preservation","Yoruba as a Career","Atunyẹwo ati Ìdánwò"],
      ["FSLC Yoruba: Full Revision","Past Questions Practice","Oral Yoruba Assessment","Composition Review","Atunyẹwo Gbogbo","Ìdánwò Ikẹhin","Ìdánwò"]
    ),
  },
  {
    title: "Primary 6 – Yoruba",
    level: "primary", className: "Primary 6", subjectName: "Yoruba",
    description: "Yoruba for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["Yoruba Review: Phonology and Grammar","Yoruba Review: Composition","Yoruba Review: Oral Literature","Yoruba Review: Written Literature","Yoruba Review: Cultural Studies","Yoruba Review: Proverbs and Idioms","Yoruba Review: Letter Writing","Yoruba Review: Narrative Writing","Yoruba Review: Comprehension","Yoruba Review: Poetry","Yoruba Review: Drama","Atunyẹwo ati Ìdánwò"],
      ["FSLC Yoruba: Objectives","FSLC Yoruba: Theory Questions","Kika Ìtàn: Extended Reading","Àkọsílẹ: Past Questions","Ewì: Oral and Written","Mock FSLC Yoruba","Àyẹwo Ìfọrọwánilẹjẹ","Examination Techniques","Àtúnyẹwò Aṣeyọri","Portfolio Review","Final Oral Practice","Atunyẹwo ati Ìdánwò"],
      ["Final Revision: Grammar","Final Revision: Literature","Final Revision: Composition","FSLC Mock","Final Preparation","Final Revision","Ìdánwò"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  IGBO — Primary 1–6 and JSS 1–3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Igbo",
    level: "primary", className: "Primary 1", subjectName: "Igbo",
    description: "Igbo for Primary 1: alphabet, basic words, simple sentences and Igbo culture.",
    topics: terms(
      ["Mkpụrụedemede Igbo: Otu Mkpụrụedemede","Olu Ọnụ: Vowels in Igbo (a, e, i, o, u)","Mgbochiume: Consonants","Akara Igbo: Tone Marks (Introduction)","Aha: Names of People","Ihe: Names of Things","Anụmanụ: Animals in Igbo","Ọchịcho Igbo: Short Words","Okwu Abụọ: Two-Word Phrases","Ezinụlọ: Nna, Nne, Nwanna","Ụlọ Akwụkwọ: My School","Ọtụtụ yana Ọlụlụ"],
      ["Okirikiri ụka: Numbers 1–10 in Igbo","Ọ dị ọcha: Colours in Igbo","Ọ bụ gịnị?: Asking What Things Are","Ọlụlụ: Reading Simple Sentences","Ịde Mkpụrụedemede","Ọchịcho Eziokwu: True-Word Reading","Ihe oriri: Food in Igbo","Anya m hụrụ: I See...","Ịkọ Akụkọ Ihe: Short Story Telling","Ụbọchị Izu: Days of the Week","Ọnwa: Months of the Year","Ọtụtụ yana Ọlụlụ"],
      ["Akụkọ Igbo: Short Folktale","Egwu Igbo: Traditional Songs","Gwa onye ihe: Tell Someone Something","Ọtụtụ Ihe Nile: Whole Review","Ọlụlụ Final","Ìdánwò Ikẹhin","Ọlụlụ"]
    ),
  },
  {
    title: "Primary 2 – Igbo",
    level: "primary", className: "Primary 2", subjectName: "Igbo",
    description: "Igbo for Primary 2 advancing grammar, Igbo culture and simple compositions.",
    topics: terms(
      ["Ụdị Mkpụrụedemede: Vowels Review","Tọn ụda: Tone Practice","Aha Ihe: Noun Categories","Ngwaa: Verbs in Igbo","Nkọwa: Adjectives","Olu Ihe: Simple Sentences","Ajụjụ: Asking Questions in Igbo","Ọzọ: Adverbs","Njikọ Okwu: Conjunctions","Ederede: Writing Sentences","Akwụkwọ Ozi: Simple Letter Writing","Ọtụtụ yana Ọlụlụ"],
      ["Ọmụmụ Igbo: Igbo Traditions","Iri Ji: New Yam Festival","Ịgba Nkwụ: Palm Wine Ceremony","Egwu na Ọmụmụ: Songs and Culture","Ịtụ Egwu Igbo: Music Practice","Akụkọ Mmụọ: Folktale Retelling","Ahịa: Market in Igbo","Ọ bụ gị: Identifying Yourself","Ụgbọ elu na ụgbọ igwe","Ọ dị mma: It Is Fine – Greetings","Ịgụ akwụkwọ: Reading a Story","Ọtụtụ yana Ọlụlụ"],
      ["Igbo nà Oge a: Igbo Today","Igbo na Ihe Ọmụmụ: Language in Education","Ọtụtụ Akụkọ: Story Reading","Agwa Igbo: Igbo Values","Review Nile","Ìdánwò Ikẹhin","Ọlụlụ"]
    ),
  },
  {
    title: "Primary 3 – Igbo",
    level: "primary", className: "Primary 3", subjectName: "Igbo",
    description: "Igbo for Primary 3 covering grammar, literature and Igbo traditional knowledge.",
    topics: terms(
      ["Ọdịnaala Igbo: Traditional Customs","Ụlọ Ọchịchị: Government in Igbo","Ọdịnaala Eze: Chieftaincy Titles","Igbo Ekpere: Prayer in Igbo","Ụdịdị Aha: Noun Types","Ọnụọgụ na Ọtụtụ: Singular and Plural","Oge Ngwaa: Verb Tenses","Ịtụ Akụkọ: Story Writing","Akwụkwọ Ozi Nke Elu: Formal Letter","Ịjụ Ajụjụ na Ịza: Q and A","Okwu Mmekọ: Synonyms","Ọtụtụ yana Ọlụlụ"],
      ["Akụkọ Ifo Igbo: Folktales","Egwu Ụmụ: Children's Songs","Ilu Igbo: Proverbs and Meanings","Akụkọ Mmụọ: Spirit Stories","Ịgba Mgba: Traditional Wrestling","Ọ dị Mma: Dialogue Practice","Ịrị Ji: Cultural Significance","Ọ bụ ife: Igbo Riddles","Ude Igbo: Igbo Herbal Medicine","Mmanya Ngwo: Palm Wine Tradition","Igbo Language in Media","Ọtụtụ yana Ọlụlụ"],
      ["Igbo Ederede: Reading Comprehension","Igbo Ọmụmụ nà Oge a: Current Relevance","Igbo Egwu na Ụbọchị Festivals","Ọtụtụ Nile: Full Review","Ìdánwò Ikẹhin","Igbo Day Celebration","Ọlụlụ"]
    ),
  },
  {
    title: "Primary 4 – Igbo",
    level: "primary", className: "Primary 4", subjectName: "Igbo",
    description: "Igbo for Primary 4 advancing composition, oral literature and intermediate grammar.",
    topics: terms(
      ["Igbo Grammar: Advanced Noun Classes","Igbo Verbs: Aspect and Tense","Infinitive and Imperative","Interrogative Structures","Compound Sentences in Igbo","Complex Sentences","Igbo Composition: Narrative","Igbo Composition: Descriptive","Igbo Composition: Argumentative (Simple)","Ọdịnaala: Customs and Taboos","Iwu Igbo: Traditional Law","Ọtụtụ yana Ọlụlụ"],
      ["Igbo Literature: Oral Traditions","Epics: The Story of Chukwuemeka Ike","Chinua Achebe: Brief Introduction","Things Fall Apart: Background","Igbo Language in Literature","Dialect Variation in Igbo","Igbo Speakers Worldwide","Igbo in the Diaspora","Standard Igbo vs Dialectal Igbo","Igbo Language Policy in Nigeria","Preserving Igbo Language","Ọtụtụ yana Ọlụlụ"],
      ["FSLC Igbo Review","Past Questions Practice","Oral Igbo Assessment","Igbo Composition Review","Ọtụtụ Nile","Ìdánwò Ikẹhin","Ọlụlụ"]
    ),
  },
  {
    title: "Primary 5 – Igbo",
    level: "primary", className: "Primary 5", subjectName: "Igbo",
    description: "Igbo for Primary 5 with advanced literature, Igbo history and FSLC preparation.",
    topics: terms(
      ["Igbo Linguistics: Phonology Review","Morphology: Word Classes in Depth","Syntax: Sentence Patterns","Igbo Literature: Novels and Stories","Igbo Oral Literature: Epics","Ilu Igbo: 30 Key Proverbs","Akụkọ Ifo: Classification","Igbo Drama: Writing a Short Play","Igbo Poetry: Forms and Examples","Composition: Letter to My Eze","Igbo Language Planning: Standardisation","Ọtụtụ yana Ọlụlụ"],
      ["Igbo World View: Chi and Destiny","Igbo Cosmology: Ani and Igwe","Igbo Social Organisation: Umunna","Age Grades in Igbo Society","Women in Igbo Culture","Igbo Arts: Uli Painting","Igbo Music: Ogene and Igba","Igbo Cuisine: Traditional Dishes","Igbo History: Pre-Colonial","Igbo in Nigerian Literature","Igbo Technology: Traditional Crafts","Ọtụtụ yana Ọlụlụ"],
      ["FSLC Igbo: Full Revision","Oral Igbo: Advanced","Igbo Composition: FSLC Format","Past Questions","Ọtụtụ Nile","Ìdánwò Ikẹhin","Ọlụlụ"]
    ),
  },
  {
    title: "Primary 6 – Igbo",
    level: "primary", className: "Primary 6", subjectName: "Igbo",
    description: "Igbo for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["Igbo Review: Grammar","Igbo Review: Vocabulary","Igbo Review: Composition","Igbo Review: Literature","Igbo Review: Oral Skills","Igbo Review: Proverbs","Igbo Review: Culture","Igbo Review: History","Igbo Review: Comprehension","Igbo Review: Letter Writing","Igbo Review: Creative Writing","Ọtụtụ yana Ọlụlụ"],
      ["FSLC Igbo: Objectives","FSLC Igbo: Theory","Ọdịnaala Test","Past Questions Practice","Mock FSLC Igbo","Oral Igbo Assessment","Composition Competition","Portfolio Review","Examination Techniques","Igbo Language Day","Peer Review","Ọtụtụ yana Ọlụlụ"],
      ["Final Revision: Grammar and Vocab","Final Revision: Literature","Final Revision: Composition","FSLC Mock","Final Preparation","Final Revision","Ọlụlụ"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  HAUSA — Primary 1–6 and JSS 1–3
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Hausa",
    level: "primary", className: "Primary 1", subjectName: "Hausa",
    description: "Hausa for Primary 1: alphabet, basic vocabulary, greetings and simple sentences.",
    topics: terms(
      ["Haruffan Hausa: Baƙaƙe","Wasulan Hausa: Vowels A, E, I, O, U","Tones in Hausa: High and Low","Sunaye: Names of People","Abubuwa: Names of Objects","Dabbobi: Animals in Hausa","Launi: Colours in Hausa","Dangantaka: Inna, Baba, Yaya","Makaranta: School Words","Abinci: Food in Hausa","Ƙidaya: Numbers 1–10","Bita da Jarabawa"],
      ["Kwanakin Mako: Days of the Week","Watannin Shekara: Months","Mutum: Body Parts","Tufafi: Clothes","Gida: Parts of the House","Salam: Greetings","Yaya kake?: How Are You?","Ina Sunanka?: What Is Your Name?","Nawa ne?: How Much Is It?","Rubutu: Writing Simple Sentences","Karatu: Reading Short Words","Bita da Jarabawa"],
      ["Magana a Hausa: Speaking Practice","Waƙar Hausa: A Simple Hausa Song","Gajeren Labarai: Short Story","Review Duk","Jarabawa ta Ƙarshe","Jimla","Jarabawa"]
    ),
  },
  {
    title: "Primary 2 – Hausa",
    level: "primary", className: "Primary 2", subjectName: "Hausa",
    description: "Hausa for Primary 2 advancing grammar, vocabulary and Hausa cultural knowledge.",
    topics: terms(
      ["Sunayen Mutane: Common and Proper Nouns","Ayyuka: Verbs in Hausa","Sifofin: Adjectives","Tambayoyi: Asking Questions","Amsoshi: Giving Answers","Jimla Mai Sauƙi: Simple Sentences","Jimla Mai Rikitarwa: Complex Sentences","Rubutu: Writing a Paragraph","Kalmomin Hanyar: Directions","Tsarin Gari: Town Layout","Kasuwa: At the Market","Bita da Jarabawa"],
      ["Al'adun Hausa: Customs","Sallah: Eid Celebrations","Darikar Hausa: Hausa Ethnic Groups","Masarautar Hausa: Emirate System","Zane-zane: Traditional Hausa Art","Kiɗa: Traditional Hausa Music","Waƙe-waƙe: Hausa Songs","Sutura ta Gargajiya: Traditional Dress","Abincin Gargajiya: Traditional Food","Labarai da Tatsuniyoyi: Folktales","Karin Magana: Hausa Proverbs","Bita da Jarabawa"],
      ["Hausa a Ƙasar Nijeriya: Importance","Karatu: Reading a Story","Rubutu: Write Your Story","Review Duk","Jarabawa ta Ƙarshe","Jimla","Jarabawa"]
    ),
  },
  {
    title: "Primary 3 – Hausa",
    level: "primary", className: "Primary 3", subjectName: "Hausa",
    description: "Hausa for Primary 3 covering literature, grammar and Hausa traditions.",
    topics: terms(
      ["Rubutu: Composition Writing","Insha'i: Narrative Composition","Wasika: Letter Writing in Hausa","Abin Mamaki: Descriptive Writing","Tunani: Argumentative Writing","Tsattsauran Magana: Direct Speech","Magana ta Hanyar Wani: Reported Speech","Labarai: Story Analysis","Ayar Waka: Poetry Analysis","Karin Magana: 20 Key Proverbs","Tatsuniya: Folktale Structure","Bita da Jarabawa"],
      ["Al'adun Aure: Marriage Customs","Ranakun Sallah: Festival Days","Hakimi da Sarki: Traditional Leadership","Noma: Hausa Farming Traditions","Kasuwanci: Trade in Hausa Society","Addinin Musulunci: Islam in Hausa Culture","Tsafin Jiki: Personal Hygiene","Harkar Soja: Hausa Military History","Dan Hausa a Waje: Diaspora","Hausa a Rubuce: Written Literature","Shehu Usman Danfodiyo: Brief History","Bita da Jarabawa"],
      ["Hausa Adabi: Literature Review","Karatu da Rubutu: Reading and Writing","Jimla Mai Girma: Advanced Sentences","Review Duk","Jarabawa ta Ƙarshe","Jimla","Jarabawa"]
    ),
  },
  {
    title: "Primary 4 – Hausa",
    level: "primary", className: "Primary 4", subjectName: "Hausa",
    description: "Hausa for Primary 4 advancing to intermediate grammar, oral literature and cultural studies.",
    topics: terms(
      ["Hausa Morphology: Word Formation","Jinsi: Gender in Hausa (Male/Female Nouns)","Lambar Jam'i: Plural Forms","Tenses: Hausa Time Expressions","Sauƙaƙe Jimla: Simplifying Sentences","Tsarin Insha'i: Essay Structure","Insha'i: My Family","Insha'i: My School","Insha'i: My Town","Wasika: Formal Letter","Wasika: Informal Letter","Bita da Jarabawa"],
      ["Hausa Literature: Oral Tradition","Tatsuniyoyi: Advanced Folktales","Waka: Hausa Poetry Forms","Karin Magana: Meanings and Uses","Hausa Proverbs in Daily Life","Hausa History: Pre-Colonial","Daular Kano: History","Daular Sokoto: History","Hausa in Modern Nigeria","Hausa Language in Media","Hausa on Radio and TV","Bita da Jarabawa"],
      ["FSLC Hausa Review","Rubutu da Karatu","Oral Hausa Assessment","Past Questions","Review Duk","Jarabawa ta Ƙarshe","Jarabawa"]
    ),
  },
  {
    title: "Primary 5 – Hausa",
    level: "primary", className: "Primary 5", subjectName: "Hausa",
    description: "Hausa for Primary 5 with advanced literature, Hausa history and FSLC preparation.",
    topics: terms(
      ["Hausa Phonology: Tone Contrasts","Hausa Dialects: Kano, Sokoto, Bauchi","Standard Hausa: Kano Dialect","Hausa Linguistics: Language Family","Hausa Literature: Written (Ajami)","Hausa Literature: Roman Script","Waka: Epic Poetry","Tatsuniya: Modern Short Stories","Hausa Drama: Simple Script","Composition: Letter to an Emir","Hausa Language Policy","Bita da Jarabawa"],
      ["Hausa History: Habe Kingdoms","Jihad of Usman Danfodiyo: 1804","Sokoto Caliphate: Structure","British Colonial Impact on Hausa","Hausa in Northern Politics","Hausa Culture: Music – Rara, Kalangu","Hausa Visual Art: Leatherwork","Hausa Cuisine: Tuwo, Miyan Kuka","Hausa Clothing: Riga and Hijab","Hausa Business: Trade and Commerce","Hausa in the Diaspora","Bita da Jarabawa"],
      ["FSLC Hausa: Full Revision","Past Questions Practice","Oral Assessment","Composition Final Practice","Review Duk","Jarabawa ta Ƙarshe","Jarabawa"]
    ),
  },
  {
    title: "Primary 6 – Hausa",
    level: "primary", className: "Primary 6", subjectName: "Hausa",
    description: "Hausa for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["Hausa Review: Grammar","Hausa Review: Vocabulary","Hausa Review: Composition","Hausa Review: Literature","Hausa Review: Oral Skills","Hausa Review: Proverbs","Hausa Review: Culture","Hausa Review: History","Hausa Review: Letter Writing","Hausa Review: Story Writing","Hausa Review: Comprehension","Bita da Jarabawa"],
      ["FSLC Hausa: Objectives","FSLC Hausa: Theory","Karatu: Extended Reading","Rubutu: FSLC Format","Oral Hausa: Assessment","Past Questions Practice","Mock FSLC Hausa","Examination Techniques","Portfolio Review","Hausa Language Day","Peer Teaching","Bita da Jarabawa"],
      ["Final Revision: Grammar and Vocab","Final Revision: Literature","Final Revision: Composition","FSLC Mock","Final Preparation","Final Revision","Jarabawa"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  FRENCH — Primary 1–6 (already done for JSS in Part 1)
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – French",
    level: "primary", className: "Primary 1", subjectName: "French",
    description: "French for Primary 1: greetings, alphabet, numbers and basic vocabulary.",
    topics: terms(
      ["Bonjour!: Greetings in French","Je m'appelle...: Introducing Myself","L'Alphabet Français: A–M","L'Alphabet Français: N–Z","Les Chiffres: 1–10","Les Couleurs: Colours","Le Corps: Body Parts","La Famille: Maman, Papa","Mon École: My School","Les Animaux: Cat, Dog, Cow","Les Fruits: Apple, Orange, Banana","Révision et Examen"],
      ["Bonjour/Bonsoir: Greetings","Au revoir: Goodbye","S'il vous plaît: Please","Merci: Thank You","Qu'est-ce que c'est?: What Is It?","C'est un/une...","Les Jours de la Semaine","Les Chiffres: 11–20","Les Légumes: Vegetables","Les Vêtements: Clothes","Je suis.../ Il est...","Révision et Examen"],
      ["Ma Maison: My House","Chez moi: At Home","J'aime...: I Like","Action Songs in French","Simple French Story","Révision Finale","Examen"]
    ),
  },
  {
    title: "Primary 2 – French",
    level: "primary", className: "Primary 2", subjectName: "French",
    description: "French for Primary 2 building on greetings, articles, basic verbs and classroom French.",
    topics: terms(
      ["Les Articles: Un, Une, Le, La","Noun Gender: Masculine and Feminine","Les Pronoms: Je, Tu, Il, Elle","Verbe Être: Je suis, Tu es...","Verbe Avoir: J'ai, Tu as...","Ma Famille: Members and Descriptions","Mon École: Classroom Objects","Les Couleurs: Mixing Colours in French","Les Jours: Monday to Sunday","Les Mois: January to December","Les Chiffres: 20–50","Révision et Examen"],
      ["Verbes en -ER: Parler, Manger","Je parle: I Speak","Qu'est-ce que tu fais?: What Are You Doing?","À l'école: At School","À la maison: At Home","La nourriture: Food I Eat","J'aime le riz: I Like Rice","Le temps: The Weather","Aujourd'hui il fait chaud: Today Is Hot","Où est...?: Where Is...?","Directions: à gauche, à droite","Révision et Examen"],
      ["Mon Ami(e): My Friend","Nous jouons: We Play","Un Pet Texte: A Short French Text","Chanter en Français: Sing in French","Révision Finale","Examen Final","Examen"]
    ),
  },
  {
    title: "Primary 3 – French",
    level: "primary", className: "Primary 3", subjectName: "French",
    description: "French for Primary 3 covering regular verbs, telling time, shopping and daily routines.",
    topics: terms(
      ["Révision: Être et Avoir","Verbes Réguliers: -ER Group","Verbes Réguliers: -IR Group","Conjugaison: Nous, Vous, Ils","La Négation: Ne...Pas","Questions: Est-ce que...?","La Routine: Morning Routine","L'heure: Telling the Time","Quelle heure est-il?: What Time Is It?","Au marché: At the Market","Combien ça coûte?: How Much?","Révision et Examen"],
      ["Les Transports: Bus, Voiture, Vélo","Aller: To Go (Irregular)","Je vais à l'école: I Go to School","Faire: To Do/Make (Irregular)","Qu'est-ce que tu fais?: Daily Activities","Pouvoir: To Be Able To","Vouloir: To Want","Les Sports: Football, Natation","J'aime jouer: I Like Playing","La Santé: Health Vocabulary","Au médecin: At the Doctor","Révision et Examen"],
      ["Ma Journée: My Day – Composition","Lettre à un Ami: Letter to a Friend","Comparatifs: More and Less","Révision Finale","Mon Texte: My Own Text","Examen Final","Examen"]
    ),
  },
  {
    title: "Primary 4 – French",
    level: "primary", className: "Primary 4", subjectName: "French",
    description: "French for Primary 4 covering past tense, descriptions and everyday French.",
    topics: terms(
      ["Le Passé Composé: Introduction","Passé Composé avec Avoir","Passé Composé avec Être","Participes Passés Irréguliers","L'Imparfait: Introduction","Contraste: Passé Composé vs Imparfait","Les Adjectifs: Accord en Genre","Les Adjectifs: Accord en Nombre","Comparatifs et Superlatifs","Ma Ville: Describing My Town","Chez le médecin: At the Doctor","Révision et Examen"],
      ["La Maison: Rooms and Furniture","Mon Quartier: My Neighbourhood","À la Poste: At the Post Office","À la Banque: At the Bank","À l'Hôtel: At the Hotel","Les Vacances: On Holiday","Les Pays Francophones: France, Côte d'Ivoire","Le Sénégal: Introduction","L'Afrique Francophone: Brief Study","Culture Française vs Nigériane","Activités du Weekend","Révision et Examen"],
      ["Rédaction: My Best Day","Lettre Formelle: To a Company","Oral French: Dialogue Practice","Révision Finale","Examen de Préparation","Examen Final","Examen"]
    ),
  },
  {
    title: "Primary 5 – French",
    level: "primary", className: "Primary 5", subjectName: "French",
    description: "French for Primary 5 advancing to FSLC level with advanced grammar and composition.",
    topics: terms(
      ["Le Futur Simple: Formation","Le Futur: Irregular Verbs","Le Conditionnel: Introduction","Les Pronoms COD et COI","Le Subjonctif: Introduction","La Voix Passive: Simple Examples","Les Expressions Idiomatiques","Compréhension Écrite: Long Passages","Rédaction: Argumentative Essay","Lettre Officielle: Formal Writing","Rapport: Report Writing","Révision et Examen"],
      ["Pays Francophones: A Deep Dive","La Francophonie: Organisation","French in Nigeria: History","French Media: RFI and France 24","French Cinema: Introduction","French Literature: Simple Extracts","Contes Francophones: African Stories","Poème: Analysis and Writing","Traduction: Translation Exercises","Jeu de Rôle: Role Play","Examen Oral: Practice","Révision et Examen"],
      ["FSLC French: Objectives","FSLC French: Theory","Past Questions Practice","Oral French Final","Révision Finale","Examen Final","Examen"]
    ),
  },
  {
    title: "Primary 6 – French",
    level: "primary", className: "Primary 6", subjectName: "French",
    description: "French for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["French Review: Grammar – All Tenses","French Review: Verbs and Conjugation","French Review: Vocabulary","French Review: Comprehension","French Review: Composition","French Review: Letter Writing","French Review: Oral Skills","French Review: Cultural Knowledge","French Review: Francophone Africa","French Review: Proverbs and Idioms","French Review: Past Questions","Révision et Examen"],
      ["FSLC French: Objectives Practice","FSLC French: Theory Questions","Compréhension: Extended Practice","Rédaction: FSLC Format","Dictée: Dictation Practice","Oral Assessment","Mock FSLC French","Examination Techniques","Portfolio Review","French Language Day","Peer Conversation Practice","Révision et Examen"],
      ["Final Revision: Grammar","Final Revision: Composition","Final Revision: Oral French","FSLC Mock","Final Preparation","Final Revision","Examen"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  VERBAL REASONING — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Verbal Reasoning",
    level: "primary", className: "Primary 1", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 1: matching, odd-one-out and simple word games.",
    topics: terms(
      ["What Is Verbal Reasoning?","Matching: Things That Go Together","Odd One Out: Simple Sets","Rhyming Words: Cat, Bat, Hat","Alphabetical Order: A to G","Alphabetical Order: H to M","Alphabetical Order: N to Z","Missing Letter: C_T (CAT)","Word Families: -at, -an, -in","Completing a Sentence","Simple Analogy: Dog is to Bark as Cat is to...","Revision and Examination"],
      ["Synonyms: Happy – Joyful","Antonyms: Hot – Cold","Classification: Animals, Fruits, Colours","Sequence: What Comes Next?","Picture Coding: Simple Codes","Word Scramble: LSAP – SLAP","Hidden Word: The DOG is big","Two-Letter Words Review","Three-Letter Words Review","Sentence Order: Arrange the Words","Reading for Detail","Revision and Examination"],
      ["Simple Logic: If A then B","True or False: Simple Statements","Pattern Recognition: Words","First and Last Letter","Review: All Topics","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Verbal Reasoning",
    level: "primary", className: "Primary 2", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 2 covering analogies, word codes and classification.",
    topics: terms(
      ["Analogy: Word Pairs","Analogy: Relationship Patterns","Classification: Groups of Items","Odd One Out: Advanced","Word Codes: A=1, B=2...","Decoding Messages","Finding Hidden Words in Sentences","Word Square: Finding Words","Missing Letters: P_NCH","Compound Words: Football, Bedroom","Prefix: Un-, Re-, Pre-","Revision and Examination"],
      ["Suffix: -ful, -less, -ness","Synonyms: More Examples","Antonyms: More Examples","Homonyms: Words That Sound Alike","Completing Word Series: BIG, BIGGER, ...","Letter Change: Change A to Get New Word","Sentence Completion: Choose the Best Word","True and False Reasoning","Simple Inference","Cause and Effect: Simple","Finding the Odd Statement","Revision and Examination"],
      ["Logic Puzzles: Simple","Sequence: Story Order","Reading a Short Passage and Answering","Review: Analogies and Codes","Final Reasoning Challenge","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Verbal Reasoning",
    level: "primary", className: "Primary 3", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 3 covering advanced analogies, coding and deductions.",
    topics: terms(
      ["Word Analogy: Extended","Relationship: Part to Whole","Relationship: Function","Letter Coding: Advanced","Number Coding: Words to Numbers","Coding by Position: A=Z, B=Y","Series: Word Sequences","Series: Letter Sequences","Classifying: 4-Group Sets","Odd One Out: Conceptual","Double Letter Words","Revision and Examination"],
      ["Finding the Odd Proverb","Completing Proverbs","Idioms: Guess the Meaning","Deduction: Simple Logic","If–Then Statements","Syllogism: All A are B...","True, False or Cannot Say","Reading a Paragraph and Inferring","Comprehension and Reasoning Combined","Verbal Puzzles","Word Maze","Revision and Examination"],
      ["Timed Verbal Exercises","Common Entrance Verbal Types","Practice Test: Full Paper","Review: All Verbal Types","Reasoning Competition","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Verbal Reasoning",
    level: "primary", className: "Primary 4", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 4 advancing towards common entrance preparation.",
    topics: terms(
      ["Analogy: Advanced Relationships","Analogy: Multiple Choice Format","Coding: Letters-Numbers Mixed","Decoding Complex Messages","Series Completion: Mixed","Letter Pattern Completion","Word Transposition","Anagram: Rearranging Letters","Making New Words from Long Words","Jumbled Sentences","Paragraph Rearranging","Revision and Examination"],
      ["Comprehension: Reading and Reasoning","Main Idea and Supporting Detail","Inference: What Can We Conclude?","Vocabulary in Context","Fact vs Opinion","Cause and Effect: Advanced","Problem Solving with Words","Logic: Either–Or Statements","Logic: Neither–Nor Statements","Verbal Analysis: Comparing Statements","Eliminating Wrong Answers","Revision and Examination"],
      ["Common Entrance Verbal Preparation","Timed Practice Tests","Strategies: Eliminating Choices","Review: All Verbal Types","Full Practice Paper","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Verbal Reasoning",
    level: "primary", className: "Primary 5", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 5 with advanced reasoning and FSLC/common entrance prep.",
    topics: terms(
      ["Analogy: Abstract Relationships","Number-Letter Coding: Advanced","Matrix Puzzles: Verbal","Critical Thinking: Evaluating Arguments","Deductive Reasoning","Inductive Reasoning","Verbal Analogies in Examinations","Vocabulary Building: High-Level Words","Synonym Chains","Antonym Chains","Contextual Vocabulary","Revision and Examination"],
      ["Reading Speed Techniques","Active Reading: Marking Key Points","Summary from a Passage","Drawing Conclusions","Identifying Author's Purpose","Distinguishing Relevant Information","Multiple-Choice Strategy","Time Management in Verbal Tests","Handling Long Passages","Eliminating Distractors","Verbal Mock Test","Revision and Examination"],
      ["FSLC Verbal Reasoning: Format","Past Questions Practice","Oral Verbal Reasoning","Full Mock Test","Review: Reasoning Strategies","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Verbal Reasoning",
    level: "primary", className: "Primary 6", subjectName: "Verbal Reasoning",
    description: "Verbal Reasoning for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["Verbal Reasoning Review: Analogies","Verbal Reasoning Review: Coding","Verbal Reasoning Review: Classification","Verbal Reasoning Review: Series","Verbal Reasoning Review: Odd One Out","Verbal Reasoning Review: Comprehension","Verbal Reasoning Review: Inference","Verbal Reasoning Review: Logic","Verbal Reasoning Review: Vocabulary","Verbal Reasoning Review: Synonyms/Antonyms","Verbal Reasoning Review: Strategies","Revision and Examination"],
      ["FSLC Verbal Reasoning: Objectives","Theory and Extended Response","Past Questions: 3 Full Papers","Timed Mock Test 1","Timed Mock Test 2","Error Analysis: Common Mistakes","Speed Reading Practice","Examination Techniques","Portfolio Review","Reasoning Competition","Final Challenge Quiz","Revision and Examination"],
      ["Final Revision: Analogy and Coding","Final Revision: Comprehension","Final Revision: Logic","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  QUANTITATIVE REASONING — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Quantitative Reasoning",
    level: "primary", className: "Primary 1", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 1: patterns, counting, simple number relationships.",
    topics: terms(
      ["What Is Quantitative Reasoning?","Counting Objects: 1–10","Number Order: Which Is More?","Number Before and After","Simple Patterns: 1, 2, 1, 2...","Shapes Pattern: Circle, Square, Circle","Matching Numbers to Groups","Adding: How Many Altogether?","Taking Away: How Many Left?","Equal Groups: Sharing","Number Line: 1–10","Revision and Examination"],
      ["Counting: 11–20","Odd and Even Numbers: Simple","Number Families: 3+2=5","Simple Number Grids","Missing Number: 3 + ? = 5","Comparing: Bigger and Smaller","Ordering Numbers: Smallest to Biggest","Grouping: Threes and Fours","Simple Number Puzzles","Shapes: Count the Sides","More or Less: Comparing Groups","Revision and Examination"],
      ["Simple Addition Puzzle","Shapes and Numbers Together","Number Patterns: Count by 2","Simple Review","Number Challenge","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Quantitative Reasoning",
    level: "primary", className: "Primary 2", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 2 covering number patterns, simple operations and basic puzzles.",
    topics: terms(
      ["Number Patterns: Skip Counting by 2, 5, 10","Odd and Even Numbers","Number Lines: 0–50","Missing Numbers in Sequences","Addition Patterns: 5+5, 10+10","Subtraction Patterns","Multiplication Concept: Arrays","Equal Groups: Sharing Fairly","Number Families: 3+4=7, 7–4=3","Simple Number Grid Puzzles","Two-Step Problems","Revision and Examination"],
      ["Magic Squares: 3×3 Simple","Finding the Rule: Input–Output","Function Table: Simple Operations","More or Less by 10","Number Bonds to 20","Fractions: Half of a Number","Doubles: 2×3=6","Near Doubles: 4+5=?","Place Value Puzzles","Rounding Numbers: Nearest 10","Simple Word Problems","Revision and Examination"],
      ["Pattern Continuation","Sorting by Rules","Simple Data Table Reading","Number Challenge Game","Review: All Patterns","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Quantitative Reasoning",
    level: "primary", className: "Primary 3", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 3 covering number logic, fraction problems and simple algebra.",
    topics: terms(
      ["Number Sequences: Advanced","Finding the Pattern Rule","Number Grids: 10×10","Function Machines: +, –, ×, ÷","Input–Output Tables","Missing Operations: 3 ? 4 = 12","Simple Equations: x + 5 = 8","Simple Equations: 10 – x = 3","Number Puzzles: Cross-Number","Fraction Patterns: Half, Quarter","Fraction Sequences","Revision and Examination"],
      ["Multiples and Factors","Finding the LCM","HCF: Simple Examples","Prime Numbers: 2, 3, 5, 7...","Square Numbers: 1, 4, 9, 16","Triangular Numbers: 1, 3, 6, 10","Simple Magic Triangles","Balance: Both Sides Equal","Simple Ratio: 1:2, 1:3","Proportion: 2 for every 3","Word Problems: Multi-Step","Revision and Examination"],
      ["Logic Grid Puzzles","Sudoku: 4×4 (Simple)","Number Pyramid","Review: All Quantitative Topics","Competition: Reasoning Race","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Quantitative Reasoning",
    level: "primary", className: "Primary 4", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 4 advancing to common entrance-style number reasoning.",
    topics: terms(
      ["Sequences: Arithmetic and Geometric","Function Machines: Two-Step","Inverse Operations","Finding the Rule: Multiple Operations","Algebraic Thinking: Letters for Numbers","Simple Simultaneous Reasoning","Logic: If–Then Number Problems","Working Backwards","Trial and Improvement","Estimation and Approximation","Checking Answers: Inverse","Revision and Examination"],
      ["Percentages: 50%, 25%, 10%","Fraction-Decimal-Percentage Link","Ratio Problems","Proportion Problems","Speed, Distance, Time (Simple)","Simple Interest Calculation","Profit and Loss in Numbers","Area: Rectangle and Triangle","Volume: Simple Boxes","Data Handling: Mean and Mode","Probability: Likely, Unlikely, Certain","Revision and Examination"],
      ["Common Entrance Quantitative: Types","Timed Practice: 20 Questions","Strategies: Eliminating Wrong Answers","Review: All Number Topics","Full Practice Test","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Quantitative Reasoning",
    level: "primary", className: "Primary 5", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 5 with advanced number reasoning and FSLC preparation.",
    topics: terms(
      ["Advanced Sequences: Fibonacci","Complex Function Machines","Multi-Step Algebraic Thinking","Abstract Number Patterns","Number Bases: Binary (Review)","Matrix-Style Number Grids","Cryptarithmetic: Puzzles","Latin Squares","Visual Number Puzzles","Estimation Strategies","Mathematical Modelling (Simple)","Revision and Examination"],
      ["Data Interpretation: Tables and Graphs","Drawing Conclusions from Data","Rate and Ratio: Advanced","Percentage: Increase and Decrease","Compound Interest (Introduction)","Word Problems: Complex Multi-Step","Real-Life Maths: Shopping Bills","Real-Life Maths: Distance and Time","Real-Life Maths: Recipe Scaling","Spatial Reasoning: Shapes and Numbers","Financial Literacy: Budgeting","Revision and Examination"],
      ["FSLC Quantitative: Format","Past Questions Practice","Timed Mock Test","Review: All Quantitative Types","Final Challenge","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Quantitative Reasoning",
    level: "primary", className: "Primary 6", subjectName: "Quantitative Reasoning",
    description: "Quantitative Reasoning for Primary 6 with FSLC comprehensive preparation.",
    topics: terms(
      ["QR Review: Number Patterns","QR Review: Function Machines","QR Review: Algebra","QR Review: Fractions and Percentages","QR Review: Ratio and Proportion","QR Review: Data and Statistics","QR Review: Geometry Numbers","QR Review: Word Problems","QR Review: Time and Distance","QR Review: Financial Maths","QR Review: Logic and Strategy","Revision and Examination"],
      ["FSLC QR: Objectives Practice","Full Paper 1 Practice","Full Paper 2 Practice","Error Analysis","Speed: Answering Under Time","Strategies: Backward Solving","Timed Mock Test 1","Timed Mock Test 2","Competition: Class Challenge","Review: Hardest Topics","Final Tips and Tricks","Revision and Examination"],
      ["Final Revision: Sequences and Patterns","Final Revision: Operations and Algebra","Final Revision: Data and Geometry","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  HANDWRITING — Primary 1–6
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "Primary 1 – Handwriting",
    level: "primary", className: "Primary 1", subjectName: "Handwriting",
    description: "Handwriting for Primary 1: pencil grip, letter formation and basic strokes.",
    topics: terms(
      ["Holding the Pencil: Correct Grip","Posture: Sitting Up Straight","Pre-Writing Strokes: Lines","Pre-Writing Strokes: Curves","Drawing Circles and Ovals","Drawing Squares and Rectangles","Forming Letter a, b, c","Forming Letters d, e, f","Forming Letters g, h, i","Forming Letters j, k, l","Forming Letters m, n, o","Revision and Examination"],
      ["Forming Letters p, q, r","Forming Letters s, t, u","Forming Letters v, w, x","Forming Letters y, z","Capital Letters A, B, C","Capital Letters D, E, F","Capital Letters G, H, I","Capital Letters J, K, L","Capital Letters M, N, O","Capital Letters P, Q, R","Capital Letters S–Z","Revision and Examination"],
      ["Writing My Name","Writing Simple Words","Writing a Short Sentence","Neatness and Spacing","My Best Page of Writing","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 2 – Handwriting",
    level: "primary", className: "Primary 2", subjectName: "Handwriting",
    description: "Handwriting for Primary 2: letter consistency, word spacing and joining letters.",
    topics: terms(
      ["Review: Lowercase Letters a–m","Review: Lowercase Letters n–z","Review: Capital Letters A–M","Review: Capital Letters N–Z","Letter Height: Ascenders (b, d, h)","Letter Depth: Descenders (g, p, y)","Size Consistency: All Letters Same Height","Spacing Between Letters","Spacing Between Words","Writing on Lines: Baseline","Copying a Sentence Neatly","Revision and Examination"],
      ["Introduction to Joined Writing (Cursive)","Joining: a–i (Anti-Clockwise)","Joining: t–l (Ascender Joins)","Joining: r–n (Arched Joins)","Joining: o–w (Diagonal Joins)","Common Joins: th, wh, ch","Writing Words in Cursive","Writing a Simple Sentence in Cursive","Copying a Paragraph","Neatness Check: Self-Assessment","Speed Writing: Short Sentences","Revision and Examination"],
      ["Dictation: Short Sentences","Best Handwriting Competition","My Handwriting Journal","Review: Joins and Neatness","Final Handwriting Test","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 3 – Handwriting",
    level: "primary", className: "Primary 3", subjectName: "Handwriting",
    description: "Handwriting for Primary 3 advancing to cursive writing, punctuation and legibility.",
    topics: terms(
      ["Cursive Review: All Lowercase Joins","Cursive Capital Letters: A–F","Cursive Capital Letters: G–M","Cursive Capital Letters: N–T","Cursive Capital Letters: U–Z","Connecting Capital to Lowercase","Punctuation in Handwriting: Full Stop","Punctuation in Handwriting: Comma","Punctuation: Question Mark and Exclamation","Apostrophe in Handwriting","Writing Dialogue: Speech Marks","Revision and Examination"],
      ["Paragraph Formation: Indentation","Writing a Full Paragraph","Speed: Increasing Writing Speed","Legibility at Speed","Neat Composition Writing","Copying a Poem Neatly","Letter Writing by Hand","Addressing an Envelope","Greeting Card Writing","Diary Entry Handwriting","Creative Handwriting: Lettering Art","Revision and Examination"],
      ["Personal Style: My Handwriting","Comparing Handwriting Styles","Best Work Display","Handwriting Portfolio","Competition: Neatest Writer","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 4 – Handwriting",
    level: "primary", className: "Primary 4", subjectName: "Handwriting",
    description: "Handwriting for Primary 4: fluent cursive, consistency and examination handwriting.",
    topics: terms(
      ["Fluent Cursive: Full Sentences","Maintaining Consistent Letter Size","Consistent Letter Spacing","Consistent Word Spacing","Slant: Keeping Uniform Slant","Pressure: Light and Confident Strokes","Writing Numbers Neatly: 0–9","Fractions and Symbols in Handwriting","Scientific Notation Writing","Exam Handwriting: Speed and Neatness","Timed Writing: 3 Sentences in 2 Minutes","Revision and Examination"],
      ["Formal Letter by Hand","Informal Letter by Hand","Report Writing by Hand","Note Taking: Abbreviations","Speed Note Taking","Mind Maps by Hand","Table Drawing by Hand","Graph Axes: Neat Labelling","Diagram Labelling","Poetry Writing: Centred and Aligned","Creative Fonts: Block Letters","Revision and Examination"],
      ["Handwriting Analysis: Common Errors","Correction Techniques","Competition: 'The Best Hand'","Handwriting for Examinations","Review: Cursive and Print","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 5 – Handwriting",
    level: "primary", className: "Primary 5", subjectName: "Handwriting",
    description: "Handwriting for Primary 5 focusing on examination quality writing and personal style.",
    topics: terms(
      ["Advanced Cursive: Complex Joins","Developing Personal Handwriting Style","Italic Handwriting: Introduction","Gothic Script: Introduction","Calligraphy: Basic Strokes","Calligraphy: Simple Letterforms","Brush Lettering: Introduction","Lettering for Posters and Signs","Typography: Print vs Digital","Handwriting in the Digital Age","Why Handwriting Still Matters","Revision and Examination"],
      ["Exam Writing Skills: Time Management","Planning Before Writing in Exams","Writing Clearly Under Pressure","Crossing Out Neatly","Inserting Corrections Properly","Margin Use in Exam Books","Answering Different Question Types","Essay Writing by Hand","Long-Answer Questions","Short-Answer Questions","Handwriting Warm-Up Exercises","Revision and Examination"],
      ["Handwriting Portfolio: Best Pieces","Peer Review: Feedback","Competition: Calligraphy Contest","Review: Exam Handwriting Strategies","Final Handwriting Assessment","Final Revision","Examination"]
    ),
  },
  {
    title: "Primary 6 – Handwriting",
    level: "primary", className: "Primary 6", subjectName: "Handwriting",
    description: "Handwriting for Primary 6 with FSLC preparation and final handwriting mastery.",
    topics: terms(
      ["Handwriting Review: Letter Formation","Handwriting Review: Cursive Joins","Handwriting Review: Consistency","Handwriting Review: Speed","Handwriting Review: Legibility","Exam Handwriting: Full Practice","Note Taking: FSLC Style","Writing Under Time Pressure","Long Composition by Hand","Letter Writing: FSLC Format","Diagram Labelling: FSLC Style","Revision and Examination"],
      ["FSLC Handwriting Practice: Essay","FSLC Handwriting Practice: Letters","FSLC Handwriting Practice: Comprehension","Timed Writing: Full Paper","Error-Free Writing Challenge","Mock FSLC Handwriting","Portfolio Finalisation","Best Work Selection","Peer Assessment","Teacher Assessment","Final Awards","Revision and Examination"],
      ["Final Revision: Cursive Writing","Final Revision: Exam Technique","Final Revision: Speed and Legibility","FSLC Mock","Final Preparation","Final Revision","Examination"]
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  JSS 1–3 — YORUBA, IGBO, HAUSA
  // ═══════════════════════════════════════════════════════════════════════

  {
    title: "JSS 1 – Yoruba",
    level: "jss", className: "JSS 1", subjectName: "Yoruba",
    description: "Yoruba for JSS 1 covering grammar, oral literature, composition and Yoruba cultural studies.",
    topics: terms(
      ["Ẹkọ Ede Yoruba: Toni ati Ọrọ","Ẹkọ Kọnsonanti ati Fawẹli","Ẹya Ọrọ: Aha, Ọrọ-Ìṣe","Ẹya Ọrọ: Àpéjúwe ati Àpẹẹrẹ","Gbólóhùn: Ṣàlàyé àti Ìbéèrè","Gbólóhùn: Àṣẹ ati Àárọ̀","Ìwé Akọsílẹ: Ìtàn Àkàwé","Kọ Ìdáhùn: Answering Questions","Ìwé Fìfún: Formal Letter Writing","Àkọsílẹ Ìtàn: Narrative","Àkọsílẹ Àpèjúwe: Descriptive","Atunyẹwo ati Ìdánwò"],
      ["Àṣà ati Ìṣẹ̀ṣe Yoruba: Marriage","Àṣà Yoruba: Naming Ceremony (Orúkọ)","Ìjókòó ati Orin Yoruba","Owe Yoruba: 30 Proverbs and Meanings","Àlọ: Types of Yoruba Riddles","Ìtàn Àtọ̀rọ̀: Folktale Study","Oriki: Praise Poetry","Ewi Àkọdá: Modern Poetry","Kika: Comprehension Passages","Ìfọrọwánilẹjẹ: Oral Discussion","Kọ Ẹsẹ Orin: Write a Poem","Atunyẹwo ati Ìdánwò"],
      ["Gbólóhùn Gíga: Complex Sentences","Àkọsílẹ Ariyanjiyan: Argumentative","Yoruba nínú Ẹkọ","Àtúnyẹwò Ìmọ Ede","BECE Preparation: Yoruba","Atunyẹwo Gbogbo","Ìdánwò"]
    ),
  },
  {
    title: "JSS 2 – Yoruba",
    level: "jss", className: "JSS 2", subjectName: "Yoruba",
    description: "Yoruba for JSS 2 advancing grammar, literature and oral composition skills.",
    topics: terms(
      ["Àtúnyẹwò: Ẹya Ọrọ","Ẹkọ Giga: Noun Classes","Ọrọ-Ìṣe Àsìkò: Tenses Review","Ọrọ Ìgbọkanle: Modal Verbs","Ẹsẹ Kíkọ: Paragraph Writing","Ìtàn Kíkọ: Story Writing (Advanced)","Kọ Ìròyìn: News Writing","Àkọsílẹ Àlàyé: Expository Writing","Wasika Ìbáṣepọ: Business Letter","Ọrọ Àgbàdo: Dialect and Standard","Orin Yoruba: Analysing Songs","Atunyẹwo ati Ìdánwò"],
      ["Adalu Ewi: Mixed Poems","D.O. Fagunwa: Ìtàn Igbo Olodumare","Ìtàn Nínú Iwe: Novel Excerpts","Owe ati Ìmọ Àṣà","Àkàwé Ẹsẹ: Poetry Comparison","Ìfọrọwánilẹjẹ Tàbí Àríyànjiyàn","Ijẹun: Oral Presentation","Ẹkọ Ìhọrọ: Language and Identity","Yoruba nínú Àwùjọ Alãyé","Yoruba Àṣà nínú Ẹkọ","Kọ Ìtàn Nípasẹ̀ Orí Ẹ̀rọ","Atunyẹwo ati Ìdánwò"],
      ["Àkọsílẹ Idaniloju: Persuasive","BECE Yoruba: Grammar","BECE Yoruba: Composition","BECE Yoruba: Oral Literature","Past Questions Practice","Atunyẹwo Gbogbo","Ìdánwò"]
    ),
  },
  {
    title: "JSS 3 – Yoruba",
    level: "jss", className: "JSS 3", subjectName: "Yoruba",
    description: "Yoruba for JSS 3 with BECE intensive revision across all Yoruba topics.",
    topics: terms(
      ["Ẹkọ Ede: Phonology Review","Ẹkọ Gíga: Morphology","Ẹkọ Gíga: Syntax","Àkọsílẹ Nínú Yoruba: All Types","Àkọsílẹ Gíga: Advanced Composition","Kọ Ìtàn Ìgbésí Ayé: Biography","Ewi: Advanced Analysis","Àlọ: Analysis and Composition","Owe: 50 Proverbs Mastery","Ìtàn Àtọ̀rọ̀ Gíga: Advanced Folktales","Oriki Àkàwé: Praise Poetry Analysis","Atunyẹwo ati Ìdánwò"],
      ["Yoruba Àṣà: Complete Review","Orúkọ nínú Àṣà Yoruba","Ẹsin nínú Àwùjọ Yoruba","Yoruba nínú Àwọn Orilẹ-ede Miran","BECE Yoruba: Paper 1 Objectives","BECE Yoruba: Paper 2 Theory","Kika Àsà: Comprehension Exam","Kọ Ìtàn: Exam Composition","Past Questions: All Topics","Mock Examination: Full Paper","Ẹ̀kọ́ Ṣíṣe Dáradára: Exam Tips","Atunyẹwo ati Ìdánwò"],
      ["Final Revision: Ede","Final Revision: Composition","Final Revision: Literature","BECE Mock","Final Preparation","Atunyẹwo Gbogbo","Ìdánwò"]
    ),
  },

  {
    title: "JSS 1 – Igbo",
    level: "jss", className: "JSS 1", subjectName: "Igbo",
    description: "Igbo for JSS 1 covering grammar, Igbo literature and cultural studies.",
    topics: terms(
      ["Mgbochiume na Ọdịdị: Phonology Review","Ụdị Mkpụrụ Edemede: Word Classes","Aha: Noun Classes in Detail","Ngwaa: Verb Aspect and Tense","Nkọwa Ahụ: Adjective Agreement","Arụmọka: Adverbs","Njikọ: Conjunctions","Ihe Ọbụna: Comprehension","Ederede Nkebiokwu: Paragraph Writing","Akwụkwọ Ozi: Letter Writing","Ederede Akụkọ: Narrative Composition","Ọtụtụ yana Ọlụlụ"],
      ["Ọdịnaala Igbo: Customs and Taboos","Ọchịchị Igbo: Traditional Government","Ọzụzụ na Ọmụmụ: Education Tradition","Iri Ji: New Yam Festival","Iwa Ọji: Kola Nut Ceremony","Akụkọ Ifo: Structure of Folktales","Ọbara Ọbara Ifo: Famous Folktales","Ilu Igbo: Proverbs and Context","Egwu Igbo: Traditional Music","Abụ Igbo: Song Analysis","Ejije na Ọmụmụ: Masquerade Tradition","Ọtụtụ yana Ọlụlụ"],
      ["Ederede Ngosi: Descriptive Writing","Ederede Ụdị: Expository Writing","Chinua Achebe: Introduction","BECE Igbo: Preparation","Past Questions Practice","Ọtụtụ Nile","Ọlụlụ"]
    ),
  },
  {
    title: "JSS 2 – Igbo",
    level: "jss", className: "JSS 2", subjectName: "Igbo",
    description: "Igbo for JSS 2 advancing literature, oral performance and advanced grammar.",
    topics: terms(
      ["Igbo Morphology: Affixation","Igbo Syntax: Sentence Patterns","Asụsụ na Omenala: Language and Culture","Ederede Ariụmọka: Argumentative Writing","Ederede Ụtọ: Persuasive Writing","Akwụkwọ Ozi Ọchịchọ: Formal Letter","Akwụkwọ Ozi Enyi: Informal Letter","Akụkọ Ihe Ọzọ: News Report","Ihe Ọbụna Dị Mma: Reading Comprehension","Arụmọka Ịsọpụta: Oral Debate","Ịkọ Akụkọ: Story Recitation","Ọtụtụ yana Ọlụlụ"],
      ["Igbo Literature: Novel Study","Odenigbo: Character Analysis","Things Fall Apart (Simple)","Igbo Drama: Short Play","Abụ: Poetry Composition","Ezeudo: Literary Analysis","Ilu: Contextual Use of Proverbs","Asụsụ Igbo na Ihe Ọmụmụ","Igbo nà Oge a: Igbo Modernisation","Ndị Igbo n'Ụwa nile: Diaspora","Mmewa Igbo: Language Preservation","Ọtụtụ yana Ọlụlụ"],
      ["BECE Igbo: Grammar Review","BECE Igbo: Composition Review","BECE Igbo: Literature Review","Past Questions Practice","Mock Examination","Ọtụtụ Nile","Ọlụlụ"]
    ),
  },
  {
    title: "JSS 3 – Igbo",
    level: "jss", className: "JSS 3", subjectName: "Igbo",
    description: "Igbo for JSS 3 with BECE intensive revision and final preparation.",
    topics: terms(
      ["Igbo Phonology: Complete Review","Morphology: Complete Review","Syntax: Complex Sentences","Ederede: All Types Review","Ilu na Akụkọ Ifo: Complete Review","Igbo Literature: All Texts Review","Igbo Ọdịnaala: Complete Review","Asụsụ na Omenala: Review","Oral Igbo: Performance Review","Igbo History: Key Points","Igbo in Nigerian Education","Ọtụtụ yana Ọlụlụ"],
      ["BECE Igbo: Paper 1 – Objectives","BECE Igbo: Paper 2 – Theory","Oral Igbo: BECE Format","Ederede: Examination Format","Past Questions: All Topics","Mock Examination: Full Paper","Common Errors in BECE Igbo","Exam Strategies","Writing Speed Practice","Oral Rehearsal","Review Sessions","Ọtụtụ yana Ọlụlụ"],
      ["Final Revision: Language","Final Revision: Literature","Final Revision: Composition","BECE Mock","Final Preparation","Ọtụtụ Nile","Ọlụlụ"]
    ),
  },

  {
    title: "JSS 1 – Hausa",
    level: "jss", className: "JSS 1", subjectName: "Hausa",
    description: "Hausa for JSS 1 covering grammar, oral literature and cultural studies.",
    topics: terms(
      ["Haruffan Hausa: Review and Extension","Wasiƙar Hausa: Letter Writing","Labari: Story Composition","Bayanin Hoto: Picture Description","Nau'o'in Jumla: Types of Sentences","Tambayoyi da Amsoshi: Q&A","Hotuna da Ƙamus: Vocabulary","Ƙamus na Hausa: Synonyms","Ma'anar Kalmomin: Word Meanings","Rubutacciyar Hausa: Written Hausa","Maganar Baka: Oral Hausa","Bita da Jarabawa"],
      ["Al'adun Hausa: Customs","Hausa Tatsuniyoyi: Folktales Analysis","Karin Magana: 40 Proverbs","Waka: Hausa Poetry Types","Roko: Praise Poetry","Hausa Drama: Reading a Script","Jarumar Hausa: Heroes in Literature","Hausa a Labarun Tarihi: History Stories","Hausa a Yau: Modern Hausa","Rediyo da TV: Hausa in Media","Al'ummar Hausa: Hausa Society","Bita da Jarabawa"],
      ["Hausa: Descriptive Composition","Hausa: Narrative Writing","BECE Hausa: Preparation","Past Questions Practice","Review Duk","Bita da Jarabawa","Jarabawa"]
    ),
  },
  {
    title: "JSS 2 – Hausa",
    level: "jss", className: "JSS 2", subjectName: "Hausa",
    description: "Hausa for JSS 2 advancing literature, oral composition and cultural analysis.",
    topics: terms(
      ["Hausa Grammar: Advanced","Jumlar Hausa: Complex Sentences","Aiki da Sauran Zaɓi: Passive Voice (Simple)","Maganar Labarai: Reported Speech","Rubutu: Argumentative Composition","Rubutu: Expository Writing","Wasiƙar Hukuma: Official Letter","Wasiƙar Abota: Friendly Letter","Rahoto: Report Writing","Tattaunawa: Oral Discussion","Muhawara: Debate in Hausa","Bita da Jarabawa"],
      ["Waka Hausa: Advanced Analysis","Tatsuniya: Structural Analysis","Adabin Hausa: Written Literature","Soja da Tatsuniyoyi: War Stories","Hausa na Zamani: Contemporary Writers","Roko: Panegyric Poetry","Hausa da Larabci: Language Contact","Hausa da Turanci: Code Switching","Adadin Kalmomi: Vocabulary Building","Hausa a Duniya: World Hausa Speakers","Preservation: Hausa Language Policy","Bita da Jarabawa"],
      ["BECE Hausa: Grammar","BECE Hausa: Composition","BECE Hausa: Literature","Past Questions Practice","Mock Examination","Review Duk","Jarabawa"]
    ),
  },
  {
    title: "JSS 3 – Hausa",
    level: "jss", className: "JSS 3", subjectName: "Hausa",
    description: "Hausa for JSS 3 with BECE intensive revision and comprehensive language study.",
    topics: terms(
      ["Hausa Phonology: Complete Review","Morphology: Complete Review","Syntax: Complex Structures","Composition: All Types Review","Hausa Literature: Complete Review","Tatsuniyoyi: Master Review","Karin Magana: 60 Proverbs Mastery","Waka: All Forms Review","Hausa Oral: Performance","Hausa History: Key Events","Hausa in Nigerian Curriculum","Bita da Jarabawa"],
      ["BECE Hausa: Paper 1 – Objectives","BECE Hausa: Paper 2 – Essays","Oral Hausa: BECE Format","Rubutu: Exam Format","Past Questions: All Topics","Mock Examination: Full Paper","Common Errors: Hausa BECE","Exam Strategies","Speed Writing","Oral Rehearsal","Review Sessions","Bita da Jarabawa"],
      ["Final Revision: Language","Final Revision: Literature","Final Revision: Composition","BECE Mock","Final Preparation","Review Duk","Jarabawa"]
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed function — gap-fill part 2
// ─────────────────────────────────────────────────────────────────────────────
export async function seedCurriculumGapFill2(): Promise<{
  added: number;
  topicsAdded: number;
  skipped: number;
  report: string[];
}> {
  console.log("📚 Running Nigerian Curriculum Gap-Fill Part 2...");

  const existing = await db.select().from(curriculumTemplates);
  const existingSet = new Set(
    existing.map((t) => `${t.className}||${t.subjectName}`)
  );

  const report: string[] = [];
  let added = 0;
  let topicsAdded = 0;
  let skipped = 0;

  const toAdd: TemplateDef[] = [];
  const willAdd: string[] = [];

  for (const tpl of T) {
    const key = `${tpl.className}||${tpl.subjectName}`;
    if (existingSet.has(key)) {
      skipped++;
    } else {
      willAdd.push(`${tpl.className} — ${tpl.subjectName}`);
      toAdd.push(tpl);
    }
  }

  report.push(`\n=== GAP-FILL PART 2 ===`);
  report.push(`Subjects to add (${willAdd.length}):`);
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
    } catch (err: any) {
      report.push(`  ❌ ERROR inserting ${tpl.title}: ${err?.message}`);
    }
  }

  report.push(`\n=== PART 2 RESULT ===`);
  report.push(`  Templates added: ${added}`);
  report.push(`  Topics added:    ${topicsAdded}`);
  report.push(`  Skipped (exist): ${skipped}`);
  report.push(`  Grand total now: ${existing.length + added}`);

  console.log(`✅ Gap fill Part 2 complete: ${added} templates, ${topicsAdded} topics added.`);
  return { added, topicsAdded, skipped, report };
}
