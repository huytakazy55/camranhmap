using System.Text.RegularExpressions;
using CamRanh.Api.Models;

namespace CamRanh.Api.Data;

public static partial class PropertyValidator
{
    [GeneratedRegex(@"^\+?[0-9 ]{8,15}$")]
    private static partial Regex PhoneRx();

    public static Dictionary<string, string[]> Validate(PropertyInput p)
    {
        var e = new Dictionary<string, string[]>();
        void Add(string key, string msg) => e[key] = [msg];

        if (string.IsNullOrWhiteSpace(p.Title) || p.Title.Trim().Length is < 3 or > 150) Add("title", "Tên từ 3 đến 150 ký tự.");
        if (string.IsNullOrWhiteSpace(p.Type) || p.Type.Trim().Length > 40) Add("type", "Loại không được để trống (tối đa 40 ký tự).");
        if (p.PriceVnd is <= 0 or > 10_000_000_000_000) Add("priceVnd", "Giá không hợp lệ.");
        if (p.AreaM2 is <= 0 or > 1_000_000_000 || double.IsNaN(p.AreaM2)) Add("areaM2", "Diện tích không hợp lệ.");
        if (p.Lng is < -180 or > 180 || p.Lat is < -90 or > 90) Add("lng", "Tọa độ không hợp lệ.");
        if (p.Polygon is null || p.Polygon.Length is < 3 or > 200
            || p.Polygon.Any(pt => pt.Length != 2 || pt[0] is < -180 or > 180 || pt[1] is < -90 or > 90 || double.IsNaN(pt[0]) || double.IsNaN(pt[1])))
            Add("polygon", "Ranh đất cần từ 3 đến 200 điểm hợp lệ.");
        if (string.IsNullOrWhiteSpace(p.Phone) || !PhoneRx().IsMatch(p.Phone.Trim())) Add("phone", "Số điện thoại không hợp lệ.");
        if (!string.IsNullOrWhiteSpace(p.Image) &&
            !(Uri.TryCreate(p.Image.Trim(), UriKind.Absolute, out var u) && u.Scheme is "http" or "https")) Add("image", "Ảnh phải là đường dẫn http(s).");
        if ((p.Desc?.Length ?? 0) > 5000) Add("desc", "Mô tả tối đa 5000 ký tự.");
        if (p.Info is { Count: > 20 } || (p.Info?.Any(i => string.IsNullOrWhiteSpace(i.Label) || i.Label.Length > 60 || (i.Value?.Length ?? 0) > 200) ?? false))
            Add("info", "Thông tin thêm tối đa 20 dòng, nhãn ≤ 60 và giá trị ≤ 200 ký tự.");
        return e;
    }
}
