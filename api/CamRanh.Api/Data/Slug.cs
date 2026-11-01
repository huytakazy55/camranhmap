using System.Globalization;
using System.Text;

namespace CamRanh.Api.Data;

public static class Slug
{
    // Bảng chuyển chữ tiếng Việt có dấu về chữ không dấu. Không dùng string.Normalize vì
    // chế độ InvariantGlobalization (để image nhỏ, không cần ICU) không tách được dấu.
    private static readonly (string From, char To)[] Groups =
    [
        ("àáạảãâầấậẩẫăằắặẳẵ", 'a'), ("èéẹẻẽêềếệểễ", 'e'), ("ìíịỉĩ", 'i'),
        ("òóọỏõôồốộổỗơờớợởỡ", 'o'), ("ùúụủũưừứựửữ", 'u'), ("ỳýỵỷỹ", 'y'), ("đ", 'd'),
    ];

    private static char Fold(char c)
    {
        foreach (var (from, to) in Groups) if (from.Contains(c)) return to;
        return c;
    }

    /// <summary>"Lô đất view vịnh" -> "lo-dat-view-vinh"</summary>
    public static string From(string text)
    {
        var sb = new StringBuilder();
        foreach (var ch in text)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue; // dấu rời (chuỗi NFD)
            var c = Fold(char.ToLowerInvariant(ch));
            sb.Append(c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : '-');
        }
        var slug = string.Join('-', sb.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "bat-dong-san" : slug.Length > 80 ? slug[..80].TrimEnd('-') : slug;
    }
}
