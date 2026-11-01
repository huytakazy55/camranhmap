FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY CamRanh.Api/CamRanh.Api.csproj CamRanh.Api/
RUN dotnet restore CamRanh.Api/CamRanh.Api.csproj
COPY . .
RUN dotnet publish CamRanh.Api/CamRanh.Api.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080 Properties__DataFile=/data/properties.json
RUN mkdir /data && chown $APP_UID /data
VOLUME /data
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "CamRanh.Api.dll"]
