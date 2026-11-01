using CamRanh.Api.Models;

namespace CamRanh.Api.Data;

public interface IPropertyRepository
{
    IReadOnlyList<Property> List(string? type = null);
    Property? Find(string slug);
    /// <summary>Thêm mới: sinh id và slug (không trùng) rồi lưu.</summary>
    Property Add(PropertyInput input);
    /// <summary>Sửa: giữ nguyên id và slug (để link cũ không gãy). Trả về null nếu không có.</summary>
    Property? Update(string slug, PropertyInput input);
    bool Delete(string slug);
}
