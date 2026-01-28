/**
 * Core WebVTT options for text tracks (subtitles/captions).
 * Used for regular text tracks with a source URL.
 */
export interface TextTrackOptions {
  /**
   * The kind of text track: 'subtitles' or 'captions'
   */
  kind?: 'subtitles' | 'captions';
  /**
   * The URL of the subtitle/caption file (VTT, SRT, etc.)
   * For transcript files, use a URL ending with '.transcript'
   */
  src?: string;
  /**
   * Language code for the text track (e.g., 'en', 'es', 'fr')
   */
  srclang?: string;
  /**
   * Display label for the text track in the subtitle menu
   */
  label?: string;
  /**
   * Whether this track should be selected by default
   */
  default?: boolean;
  /**
   * Maximum number of words per subtitle line (only for transcript files)
   * @default 4
   */
  maxWordsPerLine?: number;
  /**
   * Enable word-level highlighting in subtitles (only for transcript files)
   * When enabled, words are highlighted as they are spoken
   * @default false
   */
  highlightWords?: boolean;
}

export const languageCodes = Object.freeze({
  af: 'AFRIKAANS',
  sq: 'ALBANIAN',
  am: 'AMHARIC',
  ar: 'ARABIC',
  hy: 'ARMENIAN',
  as: 'ASSAMESE',
  ay: 'AYMARA',
  az: 'AZERBAIJANI',
  bm: 'BAMBARA',
  eu: 'BASQUE',
  be: 'BELARUSIAN',
  bn: 'BENGALI',
  bho: 'BHOJPURI',
  bs: 'BOSNIAN',
  bg: 'BULGARIAN',
  ca: 'CATALAN',
  ceb: 'CEBUANO',
  ny: 'CHICHEWA',
  zh_CN: 'CHINESE_SIMPLIFIED',
  zh_TW: 'CHINESE_TRADITIONAL',
  co: 'CORSICAN',
  hr: 'CROATIAN',
  cs: 'CZECH',
  da: 'DANISH',
  dv: 'DHIVEHI',
  doi: 'DOGRI',
  nl: 'DUTCH',
  en: 'ENGLISH',
  eo: 'ESPERANTO',
  et: 'ESTONIAN',
  ee: 'EWE',
  tl: 'FILIPINO',
  fi: 'FINNISH',
  fr: 'FRENCH',
  fy: 'FRISIAN',
  gl: 'GALICIAN',
  ka: 'GEORGIAN',
  de: 'GERMAN',
  el: 'GREEK',
  gn: 'GUARANI',
  gu: 'GUJARATI',
  ht: 'HAITIAN_CREOLE',
  ha: 'HAUSA',
  haw: 'HAWAIIAN',
  iw: 'HEBREW',
  hi: 'HINDI',
  hmn: 'HMONG',
  hu: 'HUNGARIAN',
  is: 'ICELANDIC',
  ig: 'IGBO',
  ilo: 'ILOCANO',
  id: 'INDONESIAN',
  ga: 'IRISH',
  it: 'ITALIAN',
  ja: 'JAPANESE',
  jw: 'JAVANESE',
  kn: 'KANNADA',
  kk: 'KAZAKH',
  km: 'KHMER',
  rw: 'KINYARWANDA',
  gom: 'KONKANI',
  ko: 'KOREAN',
  kri: 'KRIO',
  ku: 'KURDISH_KURMANJI',
  ckb: 'KURDISH_SORANI',
  ky: 'KYRGYZ',
  lo: 'LAO',
  la: 'LATIN',
  lv: 'LATVIAN',
  ln: 'LINGALA',
  lt: 'LITHUANIAN',
  lg: 'LUGANDA',
  lb: 'LUXEMBOURGISH',
  mk: 'MACEDONIAN',
  mai: 'MAITHILI',
  mg: 'MALAGASY',
  ms: 'MALAY',
  ml: 'MALAYALAM',
  mt: 'MALTESE',
  mi: 'MAORI',
  mr: 'MARATHI',
  mni_Mtei: 'MEITEILON_MANIPURI',
  lus: 'MIZO',
  mn: 'MONGOLIAN',
  my: 'MYANMAR_BURMESE',
  ne: 'NEPALI',
  no: 'NORWEGIAN',
  or: 'ODIA_ORIYA',
  om: 'OROMO',
  ps: 'PASHTO',
  fa: 'PERSIAN',
  pl: 'POLISH',
  pt: 'PORTUGUESE',
  pa: 'PUNJABI',
  qu: 'QUECHUA',
  ro: 'ROMANIAN',
  ru: 'RUSSIAN',
  sm: 'SAMOAN',
  sa: 'SANSKRIT',
  gd: 'SCOTS_GAELIC',
  nso: 'SEPEDI',
  sr: 'SERBIAN',
  st: 'SESOTHO',
  sn: 'SHONA',
  sd: 'SINDHI',
  si: 'SINHALA',
  sk: 'SLOVAK',
  sl: 'SLOVENIAN',
  so: 'SOMALI',
  es: 'SPANISH',
  su: 'SUNDANESE',
  sw: 'SWAHILI',
  sv: 'SWEDISH',
  tg: 'TAJIK',
  ta: 'TAMIL',
  tt: 'TATAR',
  te: 'TELUGU',
  th: 'THAI',
  ti: 'TIGRINYA',
  ts: 'TSONGA',
  tr: 'TURKISH',
  tk: 'TURKMEN',
  ak: 'TWI',
  uk: 'UKRAINIAN',
  ur: 'URDU',
  ug: 'UYGHUR',
  uz: 'UZBEK',
  vi: 'VIETNAMESE',
  cy: 'WELSH',
  xh: 'XHOSA',
  yi: 'YIDDISH',
  yo: 'YORUBA',
  zu: 'ZULU',
  // Newly added languages
  ab: 'ABKHAZ',
  ace: 'ACEHNESE',
  ach: 'ACHOLI',
  aa: 'AFAR',
  alz: 'ALUR',
  av: 'AVAR',
  awa: 'AWADHI',
  ban: 'BALINESE',
  bal: 'BALUCHI',
  bci: 'BAOULE',
  ba: 'BASHKIR',
  btx: 'BATAK_KARO',
  bts: 'BATAK_SIMALUNGUN',
  bbc: 'BATAK_TOBA',
  bem: 'BEMBA',
  bew: 'BETAWI',
  bik: 'BIKOL',
  br: 'BRETON',
  bua: 'BURYAT',
  yue: 'CANTONESE',
  ch: 'CHAMORRO',
  ce: 'CHECHEN',
  chk: 'CHUUKESE',
  cv: 'CHUVASH',
  crh: 'CRIMEAN_TATAR',
  prs: 'DARI',
  din: 'DINKA',
  dov: 'DOMBE',
  dyu: 'DYULA',
  dz: 'DZONGKHA',
  fo: 'FAROESE',
  fj: 'FIJIAN',
  fon: 'FON',
  fur: 'FRIULIAN',
  ff: 'FULANI',
  gaa: 'GA',
  cnh: 'HAKHA_CHIN',
  hil: 'HILIGAYNON',
  hrx: 'HUNSRIK',
  iba: 'IBAN',
  iu_Latn: 'INUKTITUT_LATIN',
  iu: 'INUKTITUT_SYLLABICS',
  jam: 'JAMAICAN_PATOIS',
  kac: 'JINGPO',
  kl: 'KALAALLISUT',
  kr: 'KANURI',
  pam: 'KAPAMPANGAN',
  ks: 'KASHMIRI',
  kha: 'KHASI',
  cgg: 'KIGA',
  kg: 'KIKONGO',
  ktu: 'KITUBA',
  trp: 'KOKBOROK',
  kv: 'KOMI',
  lki: 'KURDISH_LAKI',
  ltg: 'LATGALIAN',
  lij: 'LIGURIAN',
  li: 'LIMBURGISH',
  lmo: 'LOMBARD',
  luo: 'LUO',
  mad: 'MADURESE',
  mak: 'MAKASSAR',
  ms_Jawi: 'MALAY_JAWI',
  mam: 'MAM',
  gv: 'MANX',
  mh: 'MARSHALLESE',
  mwr: 'MARWARI',
  mfe: 'MAURITIAN_CREOLE',
  mhr: 'MEADOW_MARI',
  min: 'MINANGKABAU',
  nhe: 'NAHUATL_EASTERN_HUASTECA',
  ndc: 'NDAU',
  nr: 'NDEBELE_SOUTH',
  nap: 'NEAPOLITAN',
  new: 'NEPALBHASA_NEWARI',
  nqo: 'NKO',
  nus: 'NUER',
  nyn: 'NYANKOLE',
  oc: 'OCCITAN',
  os: 'OSSETIAN',
  pag: 'PANGASINAN',
  pap: 'PAPIAMENTO',
  pa_Arab: 'PUNJABI_SHAHMUKHI',
  kek: 'QEQCHI',
  rom: 'ROMANI',
  rn: 'RUNDI',
  se: 'SAMI_NORTHERN',
  sg: 'SANGO',
  sat: 'SANTALI',
  sc: 'SARDINIAN',
  crs: 'SEYCHELLOIS_CREOLE',
  shn: 'SHAN',
  scn: 'SICILIAN',
  szl: 'SILESIAN',
  sus: 'SUSU',
  ss: 'SWATI',
  ty: 'TAHITIAN',
  zgh: 'TAMAZIGHT',
  zgh_Tfng: 'TAMAZIGHT_TIFINAGH',
  tet: 'TETUM',
  bo: 'TIBETAN',
  tiv: 'TIV',
  tpi: 'TOK_PISIN',
  to: 'TONGAN',
  lua: 'TSHILUBA',
  tcy: 'TULU',
  tum: 'TUMBUKA',
  tyv: 'TUVAN',
  udm: 'UDMURT',
  ve: 'VENDA',
  vec: 'VENETIAN',
  wa: 'WALLOON',
  war: 'WARAY',
  wo: 'WOLOF',
  sah: 'YAKUT',
  yua: 'YUCATEC_MAYA',
  zap: 'ZAPOTEC',
});

/**
 * Options for auto-generated subtitles using AI transcription.
 * When autoGenerate is true, subtitles are automatically generated from the video's audio.
 */
export interface AutoGeneratedTextTrackOptions {
  /**
   * Must be set to true to enable auto-generated subtitles
   */
  autoGenerate: true;
  /**
   * Whether to show auto-generated subtitles in the subtitle dropdown menu
   * @default true
   */
  showAutoGenerated?: boolean;
  /**
   * Maximum number of words per subtitle line
   * @default 4
   */
  maxWordsPerLine?: number;
  /**
   * Enable word-level highlighting in subtitles
   * When enabled, words are highlighted as they are spoken
   * @default false
   */
  highlightWords?: boolean;
  /**
   * Custom label for the auto-generated subtitle track
   * If not provided, defaults to "AI Gen Subtitles"
   */
  autoGeneratedLabel?: string;
  /**
   * Whether this track should be selected by default
   */
  default?: boolean;
  /**
   * Array of translation options for the auto-generated subtitles
   * Each translation provides subtitles in a different language
   */
  translations?: Array<{
    /**
     * Language code for the translation (e.g., 'fr', 'hi', 'es')
     * Must be a valid key from the languageCodes object
     */
    langCode: keyof typeof languageCodes;
    /**
     * Custom label for this translation track
     * If not provided, defaults to "{Language Name} (AI generated)"
     */
  label?: string;
    /**
     * Whether this translation should be selected by default
     */
    default?: boolean;
  }>;
}

export type RemoteTextTrackOptions = TextTrackOptions | AutoGeneratedTextTrackOptions;