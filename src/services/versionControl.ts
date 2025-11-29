interface DiffOperation {
  type: 'insert' | 'delete' | 'equal';
  text: string;
  position: number;
}

interface Delta {
  operations: DiffOperation[];
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class DeltaCompression {
  static createDelta(baseText: string, newText: string): Delta {
    const operations = this.computeDiff(baseText, newText);
    const originalSize = newText.length;
    const compressedSize = this.calculateCompressedSize(operations);
    const compressionRatio = compressedSize / originalSize;

    return {
      operations,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  }

  static applyDelta(baseText: string, delta: Delta): string {
    let result = baseText;
    let offset = 0;

    for (const op of delta.operations) {
      if (op.type === 'insert') {
        result = result.slice(0, op.position + offset) + op.text + result.slice(op.position + offset);
        offset += op.text.length;
      } else if (op.type === 'delete') {
        result = result.slice(0, op.position + offset) + result.slice(op.position + offset + op.text.length);
        offset -= op.text.length;
      }
    }

    return result;
  }

  private static computeDiff(baseText: string, newText: string): DiffOperation[] {
    const operations: DiffOperation[] = [];

    const baseLines = baseText.split('\n');
    const newLines = newText.split('\n');

    const lcs = this.longestCommonSubsequence(baseLines, newLines);

    let baseIdx = 0;
    let newIdx = 0;
    let position = 0;

    for (const [lcsBase, lcsNew] of lcs) {
      while (baseIdx < lcsBase) {
        operations.push({
          type: 'delete',
          text: baseLines[baseIdx],
          position,
        });
        baseIdx++;
      }

      while (newIdx < lcsNew) {
        operations.push({
          type: 'insert',
          text: newLines[newIdx],
          position,
        });
        position += newLines[newIdx].length + 1;
        newIdx++;
      }

      position += baseLines[lcsBase].length + 1;
      baseIdx++;
      newIdx++;
    }

    while (baseIdx < baseLines.length) {
      operations.push({
        type: 'delete',
        text: baseLines[baseIdx],
        position,
      });
      baseIdx++;
    }

    while (newIdx < newLines.length) {
      operations.push({
        type: 'insert',
        text: newLines[newIdx],
        position,
      });
      newIdx++;
    }

    return operations;
  }

  private static longestCommonSubsequence(arr1: string[], arr2: string[]): [number, number][] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const result: [number, number][] = [];
    let i = m;
    let j = n;

    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        result.unshift([i - 1, j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return result;
  }

  private static calculateCompressedSize(operations: DiffOperation[]): number {
    return operations.reduce((sum, op) => {
      return sum + op.text.length + 20;
    }, 0);
  }

  static shouldCompress(baseText: string, newText: string, threshold: number = 0.7): boolean {
    if (newText.length < 500) {
      return false;
    }

    const delta = this.createDelta(baseText, newText);
    return delta.compressionRatio < threshold;
  }
}

export interface DiffResult {
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  unchanged: number;
  totalChanges: number;
}

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'add' | 'delete' | 'modify';
}

export class VersionDiff {
  static computeDiff(oldText: string, newText: string): DiffResult {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const additions: DiffLine[] = [];
    const deletions: DiffLine[] = [];
    const modifications: DiffLine[] = [];
    let unchanged = 0;

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        additions.push({
          lineNumber: i + 1,
          content: newLine,
          type: 'add',
        });
      } else if (oldLine !== undefined && newLine === undefined) {
        deletions.push({
          lineNumber: i + 1,
          content: oldLine,
          type: 'delete',
        });
      } else if (oldLine !== newLine) {
        modifications.push({
          lineNumber: i + 1,
          content: newLine,
          type: 'modify',
        });
      } else {
        unchanged++;
      }
    }

    return {
      additions,
      deletions,
      modifications,
      unchanged,
      totalChanges: additions.length + deletions.length + modifications.length,
    };
  }

  static generateDiffHtml(oldText: string, newText: string): string {
    const diff = this.computeDiff(oldText, newText);
    let html = '<div class="diff-view">';

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        html += `<div class="diff-line diff-add"><span class="line-number">${i + 1}</span><span class="line-content">+ ${this.escapeHtml(newLine)}</span></div>`;
      } else if (oldLine !== undefined && newLine === undefined) {
        html += `<div class="diff-line diff-delete"><span class="line-number">${i + 1}</span><span class="line-content">- ${this.escapeHtml(oldLine)}</span></div>`;
      } else if (oldLine !== newLine) {
        html += `<div class="diff-line diff-modify"><span class="line-number">${i + 1}</span><span class="line-content">~ ${this.escapeHtml(newLine)}</span></div>`;
      } else {
        html += `<div class="diff-line"><span class="line-number">${i + 1}</span><span class="line-content">  ${this.escapeHtml(oldLine)}</span></div>`;
      }
    }

    html += '</div>';
    return html;
  }

  static calculateSimilarity(text1: string, text2: string): number {
    const len1 = text1.length;
    const len2 = text2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 100;

    const distance = this.levenshteinDistance(text1, text2);
    return ((maxLen - distance) / maxLen) * 100;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  static generateSideBySideHtml(oldText: string, newText: string): string {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    let html = '<div class="diff-side-by-side"><table><tbody>';

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      let rowClass = '';
      if (oldLine === '' && newLine !== '') {
        rowClass = 'diff-add';
      } else if (oldLine !== '' && newLine === '') {
        rowClass = 'diff-delete';
      } else if (oldLine !== newLine) {
        rowClass = 'diff-modify';
      }

      html += `<tr class="${rowClass}">`;
      html += `<td class="line-number">${i + 1}</td>`;
      html += `<td class="old-content">${this.escapeHtml(oldLine)}</td>`;
      html += `<td class="line-number">${i + 1}</td>`;
      html += `<td class="new-content">${this.escapeHtml(newLine)}</td>`;
      html += `</tr>`;
    }

    html += '</tbody></table></div>';
    return html;
  }
}

export class VersionComparisonService {
  static compare(
    versionA: { id: string; title: string; content: string; created_at: string },
    versionB: { id: string; title: string; content: string; created_at: string }
  ) {
    const diff = VersionDiff.computeDiff(versionA.content, versionB.content);
    const similarity = VersionDiff.calculateSimilarity(versionA.content, versionB.content);
    const diffHtml = VersionDiff.generateDiffHtml(versionA.content, versionB.content);
    const sideBySideHtml = VersionDiff.generateSideBySideHtml(versionA.content, versionB.content);

    return {
      versionA: {
        id: versionA.id,
        title: versionA.title,
        created_at: versionA.created_at,
        lineCount: versionA.content.split('\n').length,
        characterCount: versionA.content.length,
      },
      versionB: {
        id: versionB.id,
        title: versionB.title,
        created_at: versionB.created_at,
        lineCount: versionB.content.split('\n').length,
        characterCount: versionB.content.length,
      },
      changes: {
        additions: diff.additions.length,
        deletions: diff.deletions.length,
        modifications: diff.modifications.length,
        unchanged: diff.unchanged,
        total: diff.totalChanges,
      },
      similarity: Math.round(similarity * 100) / 100,
      diff: {
        additions: diff.additions,
        deletions: diff.deletions,
        modifications: diff.modifications,
      },
      html: {
        unified: diffHtml,
        sideBySide: sideBySideHtml,
      },
    };
  }
}
