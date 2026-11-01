using System.Text.Json;
using CamRanh.Api.Models;

namespace CamRanh.Api.Data;

/// <summary>
/// Kho dữ liệu dạng file JSON (đọc vào bộ nhớ, ghi lại sau mỗi thay đổi). Đủ cho vài trăm tin;
/// khi cần tìm kiếm/lọc phức tạp hoặc nhiều người cùng sửa, thay bằng EF Core + PostgreSQL
/// bằng cách cài đặt lại IPropertyRepository.
/// </summary>
public sealed class JsonPropertyRepository : IPropertyRepository
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly object _lock = new();
    private readonly string _dataFile;
    private List<Property> _items;

    public JsonPropertyRepository(IConfiguration config, IWebHostEnvironment env)
    {
        string Resolve(string f) => Path.IsPathRooted(f) ? f : Path.Combine(env.ContentRootPath, f);
        _dataFile = Resolve(config["Properties:DataFile"] ?? Path.Combine("App_Data", "properties.json"));
        var seed = Resolve(config["Properties:SeedFile"] ?? Path.Combine("Data", "properties.seed.json"));

        var source = File.Exists(_dataFile) ? _dataFile : seed;
        _items = JsonSerializer.Deserialize<List<Property>>(File.ReadAllText(source), Options)
                 ?? throw new InvalidOperationException($"Không đọc được {source}");
        if (source == seed) Save();
    }

    public IReadOnlyList<Property> List(string? type = null)
    {
        lock (_lock)
            return string.IsNullOrWhiteSpace(type)
                ? _items.ToList()
                : _items.Where(p => string.Equals(p.Type, type, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    public Property? Find(string slug)
    {
        lock (_lock) return _items.FirstOrDefault(p => Same(p, slug));
    }

    public Property Add(PropertyInput i)
    {
        lock (_lock)
        {
            var baseSlug = Slug.From(i.Title!);
            var slug = baseSlug;
            for (var n = 2; _items.Any(p => p.Slug == slug); n++) slug = $"{baseSlug}-{n}";
            var p = Build(Guid.NewGuid().ToString("n")[..12], slug, i);
            _items = [.. _items, p];
            Save();
            return p;
        }
    }

    public Property? Update(string slug, PropertyInput i)
    {
        lock (_lock)
        {
            var idx = _items.FindIndex(p => Same(p, slug));
            if (idx < 0) return null;
            var p = Build(_items[idx].Id, _items[idx].Slug, i);
            var next = _items.ToList();
            next[idx] = p;
            _items = next;
            Save();
            return p;
        }
    }

    public bool Delete(string slug)
    {
        lock (_lock)
        {
            var next = _items.Where(p => !Same(p, slug)).ToList();
            if (next.Count == _items.Count) return false;
            _items = next;
            Save();
            return true;
        }
    }

    private static bool Same(Property p, string slug) => string.Equals(p.Slug, slug, StringComparison.OrdinalIgnoreCase);

    private static Property Build(string id, string slug, PropertyInput i) => new(
        Id: id, Slug: slug, Type: i.Type!.Trim(), Title: i.Title!.Trim(),
        PriceVnd: i.PriceVnd, AreaM2: i.AreaM2, Lng: i.Lng, Lat: i.Lat, Polygon: i.Polygon!,
        Info: (i.Info ?? []).Where(x => !string.IsNullOrWhiteSpace(x.Value))
            .Select(x => new InfoItem(x.Label.Trim(), x.Value.Trim())).ToList(),
        Desc: (i.Desc ?? "").Trim(), Phone: i.Phone!.Trim(), Image: (i.Image ?? "").Trim());

    // Ghi ra file tạm rồi đổi tên, tránh hỏng file nếu tiến trình chết giữa chừng.
    private void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_dataFile)!);
        var tmp = _dataFile + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(_items, Options));
        File.Move(tmp, _dataFile, overwrite: true);
    }
}
