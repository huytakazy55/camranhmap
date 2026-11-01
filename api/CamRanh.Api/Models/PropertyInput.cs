namespace CamRanh.Api.Models;

/// <summary>Dữ liệu client gửi lên khi tạo bất động sản. Id, slug do máy chủ sinh.</summary>
public sealed record PropertyInput(
    string? Type,
    string? Title,
    long PriceVnd,
    double AreaM2,
    double Lng,
    double Lat,
    double[][]? Polygon,
    List<InfoItem>? Info,
    string? Desc,
    string? Phone,
    string? Image);
