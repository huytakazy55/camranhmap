namespace CamRanh.Api.Models;

public sealed record InfoItem(string Label, string Value);

/// <summary>Một bất động sản. Polygon là danh sách [lng, lat] của ranh lô đất.</summary>
public sealed record Property(
    string Id,
    string Slug,
    string Type,
    string Title,
    long PriceVnd,
    double AreaM2,
    double Lng,
    double Lat,
    double[][] Polygon,
    List<InfoItem> Info,
    string Desc,
    string Phone,
    string Image);
