/**
 * Official syllabus topic lists, extracted from the Cambridge syllabus PDFs
 * supplied by the family (see `source` on each pack). Wording and numbering are
 * Cambridge's own; nothing is added. Third-level headings (e.g. Physics 1.5.1)
 * are kept as `covers` on their parent subtopic.
 *
 */
import type { Paper, SubjectId } from '@/types';

export interface SyllabusTopic {
  ref: string;
  title: string;
  covers?: string[];
  children?: SyllabusTopic[];
}

export interface SyllabusPack {
  subjectId: SubjectId;
  code: string;
  years: string;
  source: string;
  papers: Paper[];
  /** Paper ids from earlier versions of this pack that should be removed. */
  retired?: string[];
  topics: SyllabusTopic[];
}

export const SYLLABUS_PACKS: SyllabusPack[] = [
  {
    "subjectId": "physics",
    "code": "5054",
    "years": "2026–2028",
    "source": "Cambridge O Level Physics 5054 syllabus for 2026, 2027 and 2028 (Version 2), section 3 Subject content",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Multiple Choice (1 h, 40 marks, 30%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Theory (1 h 45 min, 80 marks, 50%)"
      },
      {
        "id": "p3",
        "name": "Paper 3 — Practical Test (1 h 30 min, 40 marks, 20%)",
        "note": "Experiments at school; home practice covers data, graphs and planning."
      }
    ],
    "topics": [
      {
        "ref": "1",
        "title": "Motion, forces and energy",
        "children": [
          {
            "ref": "1.1",
            "title": "Physical quantities and measurement techniques"
          },
          {
            "ref": "1.2",
            "title": "Motion"
          },
          {
            "ref": "1.3",
            "title": "Mass and weight"
          },
          {
            "ref": "1.4",
            "title": "Density"
          },
          {
            "ref": "1.5",
            "title": "Forces",
            "covers": [
              "Balanced and unbalanced forces",
              "Friction",
              "Elastic deformation",
              "Circular motion",
              "Turning effect of forces",
              "Centre of gravity"
            ]
          },
          {
            "ref": "1.6",
            "title": "Momentum"
          },
          {
            "ref": "1.7",
            "title": "Energy, work and power",
            "covers": [
              "Energy",
              "Work",
              "Energy resources",
              "Efficiency",
              "Power"
            ]
          },
          {
            "ref": "1.8",
            "title": "Pressure"
          }
        ]
      },
      {
        "ref": "2",
        "title": "Thermal physics",
        "children": [
          {
            "ref": "2.1",
            "title": "Kinetic particle model of matter",
            "covers": [
              "States of matter",
              "Particle model"
            ]
          },
          {
            "ref": "2.2",
            "title": "Thermal properties and temperature",
            "covers": [
              "Thermal expansion of solids, liquids and gases",
              "Specific heat capacity",
              "Melting, boiling and evaporation"
            ]
          },
          {
            "ref": "2.3",
            "title": "Transfer of thermal energy",
            "covers": [
              "Conduction",
              "Convection",
              "Radiation",
              "Consequences of thermal energy transfer"
            ]
          }
        ]
      },
      {
        "ref": "3",
        "title": "Waves",
        "children": [
          {
            "ref": "3.1",
            "title": "General properties of waves"
          },
          {
            "ref": "3.2",
            "title": "Light",
            "covers": [
              "Reflection of light",
              "Refraction of light",
              "Thin lenses",
              "Dispersion of light"
            ]
          },
          {
            "ref": "3.3",
            "title": "Electromagnetic spectrum"
          },
          {
            "ref": "3.4",
            "title": "Sound"
          }
        ]
      },
      {
        "ref": "4",
        "title": "Electricity and magnetism",
        "children": [
          {
            "ref": "4.1",
            "title": "Simple magnetism and magnetic fields"
          },
          {
            "ref": "4.2",
            "title": "Electrical quantities",
            "covers": [
              "Electrical charge",
              "Electrical current",
              "Electromotive force and potential difference",
              "Resistance"
            ]
          },
          {
            "ref": "4.3",
            "title": "Electric circuits",
            "covers": [
              "Circuit diagrams and circuit components",
              "Series and parallel circuits",
              "Action and use of circuit components"
            ]
          },
          {
            "ref": "4.4",
            "title": "Practical electricity",
            "covers": [
              "Uses of electricity",
              "Electrical safety"
            ]
          },
          {
            "ref": "4.5",
            "title": "Electromagnetic effects",
            "covers": [
              "Electromagnetic induction",
              "The a.c. generator",
              "Magnetic effect of a current",
              "Forces on a current-carrying conductor",
              "The d.c. motor",
              "The transformer"
            ]
          },
          {
            "ref": "4.6",
            "title": "Uses of an oscilloscope"
          }
        ]
      },
      {
        "ref": "5",
        "title": "Nuclear physics",
        "children": [
          {
            "ref": "5.1",
            "title": "The nuclear model of the atom",
            "covers": [
              "The atom",
              "The nucleus"
            ]
          },
          {
            "ref": "5.2",
            "title": "Radioactivity",
            "covers": [
              "Detection of radioactivity",
              "The three types of emission",
              "Radioactive decay",
              "Fission and fusion",
              "Half-life",
              "Safety precautions"
            ]
          }
        ]
      },
      {
        "ref": "6",
        "title": "Space physics",
        "children": [
          {
            "ref": "6.1",
            "title": "Earth and the Solar System",
            "covers": [
              "The Earth",
              "The Solar System"
            ]
          },
          {
            "ref": "6.2",
            "title": "Stars and the Universe",
            "covers": [
              "The Sun as a star",
              "Stars",
              "The Universe"
            ]
          }
        ]
      }
    ]
  },
  {
    "subjectId": "chemistry",
    "code": "5070",
    "years": "2026–2028",
    "source": "Cambridge O Level Chemistry 5070 syllabus for 2026, 2027 and 2028, section 3 Subject content",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Multiple Choice (1 h, 40 marks, 30%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Theory (1 h 45 min, 80 marks, 50%)"
      },
      {
        "id": "p3",
        "name": "Paper 3 — Practical Test (1 h 30 min, 40 marks, 20%)",
        "note": "Zaara sits the Practical Test (not Paper 4). Based on the experimental skills in section 4 of the syllabus."
      }
    ],
    "retired": [
      "p4"
    ],
    "topics": [
      {
        "ref": "1",
        "title": "States of matter",
        "children": [
          {
            "ref": "1.1",
            "title": "Solids, liquids and gases"
          },
          {
            "ref": "1.2",
            "title": "Diffusion"
          }
        ]
      },
      {
        "ref": "2",
        "title": "Atoms, elements and compounds",
        "children": [
          {
            "ref": "2.1",
            "title": "Elements, compounds and mixtures"
          },
          {
            "ref": "2.2",
            "title": "Atomic structure and the Periodic Table"
          },
          {
            "ref": "2.3",
            "title": "Isotopes"
          },
          {
            "ref": "2.4",
            "title": "Ion and ionic bonds"
          },
          {
            "ref": "2.5",
            "title": "Simple molecules and covalent bonds"
          },
          {
            "ref": "2.6",
            "title": "Giant covalent structures"
          },
          {
            "ref": "2.7",
            "title": "Metallic bonding"
          }
        ]
      },
      {
        "ref": "3",
        "title": "Stoichiometry",
        "children": [
          {
            "ref": "3.1",
            "title": "Formulae"
          },
          {
            "ref": "3.2",
            "title": "Relative masses of atoms and molecules"
          },
          {
            "ref": "3.3",
            "title": "The mole and the Avogadro constant"
          }
        ]
      },
      {
        "ref": "4",
        "title": "Electrochemistry",
        "children": [
          {
            "ref": "4.1",
            "title": "Electrolysis"
          },
          {
            "ref": "4.2",
            "title": "Hydrogen–oxygen fuel cells"
          }
        ]
      },
      {
        "ref": "5",
        "title": "Chemical energetics",
        "children": [
          {
            "ref": "5.1",
            "title": "Exothermic and endothermic reactions"
          }
        ]
      },
      {
        "ref": "6",
        "title": "Chemical reactions",
        "children": [
          {
            "ref": "6.1",
            "title": "Physical and chemical changes"
          },
          {
            "ref": "6.2",
            "title": "Rate of reaction"
          },
          {
            "ref": "6.3",
            "title": "Reversible reactions and equilibrium"
          },
          {
            "ref": "6.4",
            "title": "Redox"
          }
        ]
      },
      {
        "ref": "7",
        "title": "Acids, bases and salts",
        "children": [
          {
            "ref": "7.1",
            "title": "The characteristic properties of acids and bases"
          },
          {
            "ref": "7.2",
            "title": "Oxides"
          },
          {
            "ref": "7.3",
            "title": "Preparation of salts"
          }
        ]
      },
      {
        "ref": "8",
        "title": "The Periodic Table",
        "children": [
          {
            "ref": "8.1",
            "title": "Arrangement of elements"
          },
          {
            "ref": "8.2",
            "title": "Group I properties"
          },
          {
            "ref": "8.3",
            "title": "Group VII properties"
          },
          {
            "ref": "8.4",
            "title": "Transition elements"
          },
          {
            "ref": "8.5",
            "title": "Noble gases"
          }
        ]
      },
      {
        "ref": "9",
        "title": "Metals",
        "children": [
          {
            "ref": "9.1",
            "title": "Properties of metals"
          },
          {
            "ref": "9.2",
            "title": "Uses of metals"
          },
          {
            "ref": "9.3",
            "title": "Alloys and their properties"
          },
          {
            "ref": "9.4",
            "title": "Reactivity series"
          },
          {
            "ref": "9.5",
            "title": "Corrosion of metals"
          },
          {
            "ref": "9.6",
            "title": "Extraction of metals"
          }
        ]
      },
      {
        "ref": "10",
        "title": "Chemistry of the environment",
        "children": [
          {
            "ref": "10.1",
            "title": "Water"
          },
          {
            "ref": "10.2",
            "title": "Fertilisers"
          },
          {
            "ref": "10.3",
            "title": "Air quality and climate"
          }
        ]
      },
      {
        "ref": "11",
        "title": "Organic chemistry",
        "children": [
          {
            "ref": "11.1",
            "title": "Formulae, functional groups and terminology"
          },
          {
            "ref": "11.2",
            "title": "Naming organic compounds"
          },
          {
            "ref": "11.3",
            "title": "Fuels"
          },
          {
            "ref": "11.4",
            "title": "Alkanes"
          },
          {
            "ref": "11.5",
            "title": "Alkenes"
          },
          {
            "ref": "11.6",
            "title": "Alcohols"
          },
          {
            "ref": "11.7",
            "title": "Carboxylic acids"
          },
          {
            "ref": "11.8",
            "title": "Polymers"
          }
        ]
      },
      {
        "ref": "12",
        "title": "Experimental techniques and chemical analysis",
        "children": [
          {
            "ref": "12.1",
            "title": "Experimental design"
          },
          {
            "ref": "12.2",
            "title": "Acid–base titrations"
          },
          {
            "ref": "12.3",
            "title": "Chromatography"
          },
          {
            "ref": "12.4",
            "title": "Separation and purification"
          },
          {
            "ref": "12.5",
            "title": "Identification of ions and gases"
          }
        ]
      }
    ]
  },
  {
    "subjectId": "economics",
    "code": "2281",
    "years": "2027–2029",
    "source": "Cambridge O Level Economics 2281 syllabus for 2027, 2028 and 2029, section 3 Subject content",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Multiple Choice (1 h, 40 marks, 30%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Structured Questions (2 h, 80 marks, 70%)",
        "note": "Section A: one compulsory question with six parts. Section B: three questions from a choice of four."
      }
    ],
    "topics": [
      {
        "ref": "1",
        "title": "The basic economic problem",
        "children": [
          {
            "ref": "1.1",
            "title": "The nature of the basic economic problem",
            "covers": [
              "Finite resources and infinite wants",
              "Resource allocation decisions",
              "Economic goods and free goods"
            ]
          },
          {
            "ref": "1.2",
            "title": "Factors of production",
            "covers": [
              "Factors of production and their rewards",
              "Quantity and quality of factors of production"
            ]
          },
          {
            "ref": "1.3",
            "title": "Opportunity cost",
            "covers": [
              "Opportunity cost",
              "The influence of opportunity cost on decision-making"
            ]
          },
          {
            "ref": "1.4",
            "title": "Production possibility curve (PPC) diagrams",
            "covers": [
              "Production possibility curves (PPC)",
              "Points under, on and beyond a PPC",
              "Movements along a PPC",
              "Shifts of a PPC"
            ]
          }
        ]
      },
      {
        "ref": "2",
        "title": "The allocation of resources",
        "children": [
          {
            "ref": "2.1",
            "title": "The role of markets in allocating resources",
            "covers": [
              "How markets work"
            ]
          },
          {
            "ref": "2.2",
            "title": "Demand",
            "covers": [
              "Individual and market demand",
              "Movements along a demand curve",
              "Shifts of a demand curve"
            ]
          },
          {
            "ref": "2.3",
            "title": "Supply",
            "covers": [
              "Individual and market supply",
              "Movements along a supply curve",
              "Shifts of a supply curve"
            ]
          },
          {
            "ref": "2.4",
            "title": "Price determination",
            "covers": [
              "Price mechanism",
              "Market equilibrium",
              "Market disequilibrium"
            ]
          },
          {
            "ref": "2.5",
            "title": "Price changes",
            "covers": [
              "Causes of price changes",
              "Consequences of price changes"
            ]
          },
          {
            "ref": "2.6",
            "title": "Price elasticity of demand (PED)",
            "covers": [
              "Definition of PED",
              "Calculation of PED",
              "Determinants of PED",
              "PED, consumer expenditure and firms’ revenue",
              "Significance of PED"
            ]
          },
          {
            "ref": "2.7",
            "title": "Price elasticity of supply (PES)",
            "covers": [
              "Definition of PES",
              "Calculation of PES",
              "Determinants of PES"
            ]
          },
          {
            "ref": "2.8",
            "title": "Market economic system",
            "covers": [
              "Definition of the market economic system",
              "Arguments for and against the market economic system"
            ]
          },
          {
            "ref": "2.9",
            "title": "Market failure",
            "covers": [
              "Definition of market failure",
              "Definitions of terms associated with market failure",
              "Causes of market failure",
              "Consequences of market failure"
            ]
          },
          {
            "ref": "2.10",
            "title": "Mixed economic system",
            "covers": [
              "Definition of the mixed economic system",
              "Arguments for and against the mixed economic system",
              "Government intervention to address market failure"
            ]
          }
        ]
      },
      {
        "ref": "3",
        "title": "Microeconomic decision-makers",
        "children": [
          {
            "ref": "3.1",
            "title": "Money and banking",
            "covers": [
              "Money",
              "Banking"
            ]
          },
          {
            "ref": "3.2",
            "title": "Households",
            "covers": [
              "Influences on households’ spending, saving and borrowing"
            ]
          },
          {
            "ref": "3.3",
            "title": "Workers",
            "covers": [
              "Factors affecting an individual’s choice of occupation",
              "Wage determination",
              "Reasons for differences in wages",
              "Mobility of labour",
              "Division of labour"
            ]
          },
          {
            "ref": "3.4",
            "title": "Firms",
            "covers": [
              "Different types of firms",
              "Mergers",
              "Economies and diseconomies of scale"
            ]
          },
          {
            "ref": "3.5",
            "title": "Firms and production",
            "covers": [
              "Demand for factors of production",
              "Labour-intensive and capital-intensive production",
              "Production and productivity"
            ]
          },
          {
            "ref": "3.6",
            "title": "Firms’ costs, revenue and objectives",
            "covers": [
              "Definitions of costs of production",
              "Calculation of costs of production",
              "Definition of revenue",
              "Calculation of revenue",
              "Objectives of firms"
            ]
          },
          {
            "ref": "3.7",
            "title": "Types of markets",
            "covers": [
              "Competitive markets",
              "Monopoly markets"
            ]
          }
        ]
      },
      {
        "ref": "4",
        "title": "Government and the macroeconomy",
        "children": [
          {
            "ref": "4.1",
            "title": "Government macroeconomic intervention",
            "covers": [
              "Macroeconomic aims"
            ]
          },
          {
            "ref": "4.2",
            "title": "Fiscal policy",
            "covers": [
              "Government budget",
              "Reasons for government spending",
              "Taxation",
              "Definition of fiscal policy",
              "Fiscal policy measures",
              "Effects of fiscal policy on government macroeconomic aims"
            ]
          },
          {
            "ref": "4.3",
            "title": "Monetary policy",
            "covers": [
              "Definitions of money supply and monetary policy",
              "Monetary policy measures",
              "Effect of monetary policy on government macroeconomic aims"
            ]
          },
          {
            "ref": "4.4",
            "title": "Supply-side policy",
            "covers": [
              "Definition of supply-side policy",
              "Supply-side policy measures",
              "Effects of supply-side policy measures on government macroeconomic aims"
            ]
          },
          {
            "ref": "4.5",
            "title": "Economic growth",
            "covers": [
              "Definition of economic growth",
              "Measurement of economic growth",
              "Causes and consequences of economic growth",
              "Causes and consequences of recession",
              "Policies to promote economic growth"
            ]
          },
          {
            "ref": "4.6",
            "title": "Employment and unemployment",
            "covers": [
              "Definitions of employment, unemployment and full employment",
              "Measurement of unemployment",
              "Causes/types of unemployment",
              "Consequences of unemployment",
              "Policies to reduce unemployment"
            ]
          },
          {
            "ref": "4.7",
            "title": "Inflation",
            "covers": [
              "Definitions of inflation and deflation",
              "Measurement of inflation",
              "Causes of inflation",
              "Consequences of inflation",
              "Policies to control inflation"
            ]
          }
        ]
      },
      {
        "ref": "5",
        "title": "Economic development",
        "children": [
          {
            "ref": "5.1",
            "title": "Living standards",
            "covers": [
              "Indicators of living standards",
              "Comparing living standards and income distribution"
            ]
          },
          {
            "ref": "5.2",
            "title": "Poverty",
            "covers": [
              "Definitions of absolute and relative poverty",
              "Causes of poverty",
              "Policies to alleviate poverty and redistribute income"
            ]
          },
          {
            "ref": "5.3",
            "title": "Population",
            "covers": [
              "Factors that affect population growth",
              "The effects of changes in the size and structure of populations"
            ]
          },
          {
            "ref": "5.4",
            "title": "Differences in economic development between countries",
            "covers": [
              "Causes and consequences of international differences"
            ]
          }
        ]
      },
      {
        "ref": "6",
        "title": "International trade and globalisation",
        "children": [
          {
            "ref": "6.1",
            "title": "Specialisation and free trade",
            "covers": [
              "Specialisation by country",
              "Free trade"
            ]
          },
          {
            "ref": "6.2",
            "title": "Globalisation and trade restrictions",
            "covers": [
              "Definition of globalisation",
              "Causes and consequences of changes in globalisation",
              "Role of multinational companies (MNCs)",
              "Types of trade restrictions / methods of protection",
              "Reasons for trade restrictions",
              "Consequences of trade restrictions"
            ]
          },
          {
            "ref": "6.3",
            "title": "Foreign exchange rates",
            "covers": [
              "Definition of foreign exchange rate",
              "Reasons for buying and selling foreign currencies",
              "Determination of foreign exchange rate in foreign exchange market",
              "Consequences of changes in foreign exchange rates"
            ]
          },
          {
            "ref": "6.4",
            "title": "Current account of the balance of payments",
            "covers": [
              "Structure of the current account of the balance of payments",
              "Causes of current account deficit and surplus",
              "Consequences of current account deficit and surplus",
              "Policies to achieve balance of payments stability"
            ]
          }
        ]
      }
    ]
  },
  {
    "subjectId": "mathd",
    "code": "4024",
    "years": "2025–2027",
    "source": "Cambridge O Level Mathematics (Syllabus D) 4024 syllabus for 2025, 2026 and 2027, section 3 Subject content",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Non-calculator (2 h, 100 marks, 50%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Calculator (2 h, 100 marks, 50%)"
      }
    ],
    "topics": [
      {
        "ref": "1",
        "title": "Number",
        "children": [
          {
            "ref": "1.1",
            "title": "Types of number"
          },
          {
            "ref": "1.2",
            "title": "Sets"
          },
          {
            "ref": "1.3",
            "title": "Powers and roots"
          },
          {
            "ref": "1.4",
            "title": "Fractions, decimals and percentages"
          },
          {
            "ref": "1.5",
            "title": "Ordering"
          },
          {
            "ref": "1.6",
            "title": "The four operations"
          },
          {
            "ref": "1.7",
            "title": "Indices I"
          },
          {
            "ref": "1.8",
            "title": "Standard form"
          },
          {
            "ref": "1.9",
            "title": "Estimation"
          },
          {
            "ref": "1.10",
            "title": "Limits of accuracy"
          },
          {
            "ref": "1.11",
            "title": "Ratio and proportion"
          },
          {
            "ref": "1.12",
            "title": "Rates"
          },
          {
            "ref": "1.13",
            "title": "Percentages"
          },
          {
            "ref": "1.14",
            "title": "Using a calculator"
          },
          {
            "ref": "1.15",
            "title": "Time"
          },
          {
            "ref": "1.16",
            "title": "Money"
          },
          {
            "ref": "1.17",
            "title": "Exponential growth and decay"
          },
          {
            "ref": "1.18",
            "title": "Surds"
          }
        ]
      },
      {
        "ref": "2",
        "title": "Algebra and graphs",
        "children": [
          {
            "ref": "2.1",
            "title": "Introduction to algebra"
          },
          {
            "ref": "2.2",
            "title": "Algebraic manipulation"
          },
          {
            "ref": "2.3",
            "title": "Algebraic fractions"
          },
          {
            "ref": "2.4",
            "title": "Indices II"
          },
          {
            "ref": "2.5",
            "title": "Equations"
          },
          {
            "ref": "2.6",
            "title": "Inequalities"
          },
          {
            "ref": "2.7",
            "title": "Sequences"
          },
          {
            "ref": "2.8",
            "title": "Proportion"
          },
          {
            "ref": "2.9",
            "title": "Graphs in practical situations"
          },
          {
            "ref": "2.10",
            "title": "Graphs of functions"
          },
          {
            "ref": "2.11",
            "title": "Sketching curves"
          },
          {
            "ref": "2.12",
            "title": "Functions"
          }
        ]
      },
      {
        "ref": "3",
        "title": "Coordinate geometry",
        "children": [
          {
            "ref": "3.1",
            "title": "Coordinates"
          },
          {
            "ref": "3.2",
            "title": "Drawing linear graphs"
          },
          {
            "ref": "3.3",
            "title": "Gradient of linear graphs"
          },
          {
            "ref": "3.4",
            "title": "Length and midpoint"
          },
          {
            "ref": "3.5",
            "title": "Equations of linear graphs"
          },
          {
            "ref": "3.6",
            "title": "Parallel lines"
          },
          {
            "ref": "3.7",
            "title": "Perpendicular lines"
          }
        ]
      },
      {
        "ref": "4",
        "title": "Geometry",
        "children": [
          {
            "ref": "4.1",
            "title": "Geometrical terms"
          },
          {
            "ref": "4.2",
            "title": "Geometrical constructions"
          },
          {
            "ref": "4.3",
            "title": "Scale drawings"
          },
          {
            "ref": "4.4",
            "title": "Similarity"
          },
          {
            "ref": "4.5",
            "title": "Symmetry"
          },
          {
            "ref": "4.6",
            "title": "Angles"
          },
          {
            "ref": "4.7",
            "title": "Circle theorems I"
          },
          {
            "ref": "4.8",
            "title": "Circle theorems II"
          }
        ]
      },
      {
        "ref": "5",
        "title": "Mensuration",
        "children": [
          {
            "ref": "5.1",
            "title": "Units of measure"
          },
          {
            "ref": "5.2",
            "title": "Area and perimeter"
          },
          {
            "ref": "5.3",
            "title": "Circles, arcs and sectors"
          },
          {
            "ref": "5.4",
            "title": "Surface area and volume"
          },
          {
            "ref": "5.5",
            "title": "Compound shapes and parts of shapes"
          }
        ]
      },
      {
        "ref": "6",
        "title": "Trigonometry",
        "children": [
          {
            "ref": "6.1",
            "title": "Pythagoras’ theorem"
          },
          {
            "ref": "6.2",
            "title": "Right-angled triangles"
          },
          {
            "ref": "6.3",
            "title": "Non-right-angled triangles"
          }
        ]
      },
      {
        "ref": "7",
        "title": "Transformations and vectors",
        "children": [
          {
            "ref": "7.1",
            "title": "Transformations"
          },
          {
            "ref": "7.2",
            "title": "Vectors in two dimensions"
          },
          {
            "ref": "7.3",
            "title": "Magnitude of a vector"
          },
          {
            "ref": "7.4",
            "title": "Vector geometry"
          }
        ]
      },
      {
        "ref": "8",
        "title": "Probability",
        "children": [
          {
            "ref": "8.1",
            "title": "Introduction to probability"
          },
          {
            "ref": "8.2",
            "title": "Relative and expected frequencies"
          },
          {
            "ref": "8.3",
            "title": "Probability of combined events"
          }
        ]
      },
      {
        "ref": "9",
        "title": "Statistics",
        "children": [
          {
            "ref": "9.1",
            "title": "Classifying statistical data"
          },
          {
            "ref": "9.2",
            "title": "Interpreting statistical data"
          },
          {
            "ref": "9.3",
            "title": "Averages and measures of spread"
          },
          {
            "ref": "9.4",
            "title": "Statistical charts and diagrams"
          },
          {
            "ref": "9.5",
            "title": "Scatter diagrams"
          },
          {
            "ref": "9.6",
            "title": "Cumulative frequency diagrams"
          },
          {
            "ref": "9.7",
            "title": "Histograms"
          }
        ]
      }
    ]
  },
  {
    "subjectId": "addmath",
    "code": "4037",
    "years": "2025–2027",
    "source": "Cambridge O Level Additional Mathematics 4037 syllabus for 2025, 2026 and 2027, section 3 Subject content (Calculus split at 14.9/14.10 by ZAARA)",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Non-calculator (2 h, 80 marks, 50%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Calculator (2 h, 80 marks, 50%)"
      }
    ],
    "topics": [
      {
        "ref": "1",
        "title": "Functions",
        "children": []
      },
      {
        "ref": "2",
        "title": "Quadratic functions",
        "children": []
      },
      {
        "ref": "3",
        "title": "Factors of polynomials",
        "children": []
      },
      {
        "ref": "4",
        "title": "Equations, inequalities and graphs",
        "children": []
      },
      {
        "ref": "5",
        "title": "Simultaneous equations",
        "children": []
      },
      {
        "ref": "6",
        "title": "Logarithmic and exponential functions",
        "children": []
      },
      {
        "ref": "7",
        "title": "Straight-line graphs",
        "children": []
      },
      {
        "ref": "8",
        "title": "Coordinate geometry of the circle",
        "children": []
      },
      {
        "ref": "9",
        "title": "Circular measure",
        "children": []
      },
      {
        "ref": "10",
        "title": "Trigonometry",
        "children": []
      },
      {
        "ref": "11",
        "title": "Permutations and combinations",
        "children": []
      },
      {
        "ref": "12",
        "title": "Series",
        "children": []
      },
      {
        "ref": "13",
        "title": "Vectors in two dimensions",
        "children": []
      },
      {
        "ref": "14",
        "title": "Calculus",
        "children": [
          {
            "ref": "14.1–14.9",
            "title": "Differentiation (incl. stationary points, rates of change, maxima and minima)"
          },
          {
            "ref": "14.10–14.15",
            "title": "Integration, definite integrals, areas and kinematics"
          }
        ]
      }
    ]
  },
  {
    "subjectId": "bangla",
    "code": "3204",
    "years": "2027",
    "source": "Cambridge O Level Bengali 3204 syllabus for 2027, section 3 Description of components (no topic list in this syllabus — units are the paper sections)",
    "papers": [
      {
        "id": "p1",
        "name": "Paper 1 — Composition (2 h, 90 marks, 45%)"
      },
      {
        "id": "p2",
        "name": "Paper 2 — Language Usage and Comprehension (1 h 30 min, 110 marks, 55%)"
      }
    ],
    "topics": [
      {
        "ref": "P1",
        "title": "Paper 1 — Composition",
        "children": [
          {
            "ref": "P1 A",
            "title": "Letter, report, dialogue or speech (about 120 words)"
          },
          {
            "ref": "P1 B",
            "title": "Essay (about 200 words)"
          }
        ]
      },
      {
        "ref": "P2",
        "title": "Paper 2 — Language Usage and Comprehension",
        "children": [
          {
            "ref": "P2 A",
            "title": "Language usage: combination or separation of words"
          },
          {
            "ref": "P2 A",
            "title": "Language usage: idioms"
          },
          {
            "ref": "P2 A",
            "title": "Language usage: proverbs"
          },
          {
            "ref": "P2 A",
            "title": "Language usage: words in pairs"
          },
          {
            "ref": "P2 A",
            "title": "Language usage: sentence transformation"
          },
          {
            "ref": "P2 A",
            "title": "Language usage: cloze passage"
          },
          {
            "ref": "P2 B",
            "title": "Comprehension: multiple-choice questions (prose passage of about 280 words)"
          },
          {
            "ref": "P2 C",
            "title": "Comprehension: open-ended questions and vocabulary (prose passage of about 270 words)"
          }
        ]
      }
    ]
  }
];

export const PACK_BY_SUBJECT: Partial<Record<SubjectId, SyllabusPack>> = Object.fromEntries(SYLLABUS_PACKS.map((p) => [p.subjectId, p]));
