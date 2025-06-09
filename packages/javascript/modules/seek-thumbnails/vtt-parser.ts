/*
https://w3c.github.io/webvtt/#webvtt-timestamp

<id>
<startTime> --> <endTime> <setting_key1>:<setting_val1> <setting_key2>:<setting_val2> <setting_key3>:<setting_val3>
<text line1>
<text line2>
<text line3>

12
00:00:00.000 --> 00:00:01.000 align:start line:10% position:25% size:50%
seek-thumbnail-sprite.jpg#xywh=0,0,150,84
*/
export type WebVTTCue = {
    startTime: number;
    endTime: number;
    settings: Record<string, string>;
    text: string;
  };
  
  const CUE_TIME_LINE_REGEXP =
    /(?:^|\n) *(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?) +--> +(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?)/;
  
  const TIMESTAMP_REGEXP =
    /(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?)/g;
  
  export function parseWebVTT(input: string): WebVTTCue[] {
    const continuousChunks = input
      .replace(/\r\n|\r|\n/g, "\n") // Normalize line endings to \n
      .replace(/\n\n+/g, "\n\n") // Remove extra blank lines
      .split("\n\n"); // Split into chunks by double newlines
    
    const cueChunks = continuousChunks.filter((chunk) =>
      CUE_TIME_LINE_REGEXP.test(chunk)
    );
  
    return cueChunks.map(parseCue);
  }
  
  function parseCue(data: string): WebVTTCue {
    const cueLines = data.split("\n");
  
    const indexOfLineWithTimestamp = cueLines
      .findIndex((line) => CUE_TIME_LINE_REGEXP.test(line));
  
    const timestampLine = cueLines[indexOfLineWithTimestamp];
    const [startTime, endTime] = timestampLine.split("-->")
      .map((s) => s.match(TIMESTAMP_REGEXP))
      .map((t) => {
        if (!t?.[0]) throw Error("Error");
        else {
          return parseTimestamp(t[0]);
        }
      });
  
    const settings = parseCueSettings(
      timestampLine.replace(CUE_TIME_LINE_REGEXP, ""),
    );
  
    const textLines: string[] = [];
    for (let i = indexOfLineWithTimestamp + 1; i < cueLines.length; i++) {
      textLines.push(cueLines[i]);
    }
    const text = textLines.join("\n");
  
    return {
      startTime,
      endTime,
      settings,
      text,
    };
  }
  
  function parseTimestamp(timestamp: string): number {
    const match = timestamp.match(TIMESTAMP_REGEXP);
    if (!match?.[0]) throw Error("Error while parsing timestamp" + timestamp);
    const [seconds, minutes, hours] = match[0].split(":").reverse();
    return (
      (hours ? parseInt(hours, 10) * 3600 : 0) +
      parseInt(minutes, 10) * 60 +
      parseFloat(seconds.replace(",", "."))
    );
  }
  
  function parseCueSettings(settingsString: string): Record<string, string> {
    return settingsString
      .split(" ")
      .filter((part) => part.includes(":"))
      .reduce((settings, part) => {
        const [key, value] = part.split(":");
        if (key && value) settings[key] = value;
        return settings;
      }, {} as Record<string, string>);
  }