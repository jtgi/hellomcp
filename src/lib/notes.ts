import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface Note {
  title: string;
  content: string;
}

export async function getNotes(page: number = 1, pageSize: number = 50): Promise<Note[]> {
  const script = `
    tell application "Notes"
      set output to ""
      set itemCount to 0
      set startIndex to (${page} - 1) * ${pageSize}
      set endIndex to startIndex + ${pageSize}
      set currentIndex to 0
      
      repeat with n in notes
        if itemCount = ${pageSize} then
          exit repeat
        end if
        if (count of attachments of n) = 0 then
          if currentIndex >= startIndex then
            set output to output & name of n & " ||| " & body of n & linefeed
            set itemCount to itemCount + 1
          end if
          set currentIndex to currentIndex + 1
        end if
      end repeat
      return output
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const notes = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [title, content] = line.split(" ||| ");
        return {
          title: title?.trim() || "",
          content: (content || "").replace(/\\n/g, "\n"),
        };
      });
    return notes;
  } catch (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
}

export async function searchNotes(query: string): Promise<Note[]> {
  const script = `
    tell application "Notes"
      set noteList to {}
      repeat with theNote in every note
        if (name of theNote contains "${query}" or body of theNote contains "${query}") then
          set noteInfo to {id:id of theNote, title:name of theNote, content:body of theNote, folder:name of container of theNote, modificationDate:modification date of theNote}
          set end of noteList to noteInfo
        end if
      end repeat
      return noteList
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const notes = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, title, content, folder, date] = line.split(", ");
        return {
          id,
          title,
          content,
          folder,
          modificationDate: date,
        };
      });
    return notes;
  } catch (error) {
    console.error("Error searching notes:", error);
    return [];
  }
}
