using System.Security.Cryptography;
using System.Text;
using CamRanh.Api.Data;
using CamRanh.Api.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IPropertyRepository, JsonPropertyRepository>();
builder.Services.AddHealthChecks();

var app = builder.Build();

var properties = app.MapGroup("/api/properties");
properties.MapGet("/", (IPropertyRepository repo, string? type) => repo.List(type));
properties.MapGet("/{slug}", (string slug, IPropertyRepository repo) =>
    repo.Find(slug) is { } p ? Results.Ok(p) : Results.NotFound());

// Ghi dữ liệu: cần header X-Admin-Key khớp với Admin:Key. Chưa cấu hình khóa thì tắt hẳn việc ghi.
var writes = properties.MapGroup("").AddEndpointFilter(async (ctx, next) =>
{
    var expected = ctx.HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Admin:Key"];
    if (string.IsNullOrEmpty(expected)) return Results.Problem("Chưa cấu hình khóa quản trị.", statusCode: 503);
    var given = ctx.HttpContext.Request.Headers["X-Admin-Key"].ToString();
    var ok = CryptographicOperations.FixedTimeEquals(
        SHA256.HashData(Encoding.UTF8.GetBytes(given)), SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
    return ok ? await next(ctx) : Results.Unauthorized();
});

writes.MapPost("/", (PropertyInput input, IPropertyRepository repo) =>
{
    var errors = PropertyValidator.Validate(input);
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    var created = repo.Add(input);
    return Results.Created($"/api/properties/{created.Slug}", created);
});

writes.MapPut("/{slug}", (string slug, PropertyInput input, IPropertyRepository repo) =>
{
    var errors = PropertyValidator.Validate(input);
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    return repo.Update(slug, input) is { } updated ? Results.Ok(updated) : Results.NotFound();
});

writes.MapDelete("/{slug}", (string slug, IPropertyRepository repo) =>
    repo.Delete(slug) ? Results.NoContent() : Results.NotFound());

app.MapHealthChecks("/healthz");

app.Run();
