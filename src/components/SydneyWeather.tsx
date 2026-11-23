
import { useEffect, useState } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";

type WeatherData = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

const API_URL =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: "-33.8688",
    longitude: "151.2093",
    current:
      "temperature_2m,apparent_temperature,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Australia/Sydney",
    forecast_days: "4",
  });

function weatherLabel(code: number) {
  if (code === 0) return "맑음";
  if (code <= 2) return "대체로 맑음";
  if (code === 3) return "흐림";
  if (code <= 48) return "안개";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈 소나기";
  return "뇌우";
}

function WeatherIcon({
  code,
  size = 24,
}: {
  code: number;
  size?: number;
}) {
  if (code === 0) return <Sun size={size} />;
  if (code <= 2) return <CloudSun size={size} />;
  if (code <= 48) return <Cloud size={size} />;
  if (code <= 67) return <CloudRain size={size} />;
  if (code <= 77) return <CloudSnow size={size} />;
  if (code <= 82) return <CloudRain size={size} />;
  if (code <= 86) return <CloudSnow size={size} />;
  return <CloudLightning size={size} />;
}

export default function SydneyWeather({
  countdown,
}: {
  countdown: string;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Weather API error");
        }

        const data: WeatherData = await response.json();

        if (!data.current || !data.daily) {
          throw new Error("Invalid weather data");
        }

        if (!controller.signal.aborted) {
          setWeather(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadWeather();

    return () => controller.abort();
  }, [refresh]);

  return (
    <section className="hero-card weather-card">
      <div className="hero-top">
        <span>SYDNEY · 실시간 날씨</span>
        <span className="hero-count">{countdown}</span>
      </div>

      {loading && (
        <p className="weather-status">날씨 불러오는 중...</p>
      )}

      {!loading && error && (
        <div className="weather-status">
          <p>날씨 확인이 안됨</p>
          <button onClick={() => setRefresh((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && weather && (
        <>
          <div className="weather-main">
            <div>
              <div className="weather-temperature">
                {Math.round(weather.current.temperature_2m)}°
              </div>

              <div className="weather-description">
                {weatherLabel(weather.current.weather_code)}
                <span>
                  체감 온도{" "}
                  {Math.round(
                    weather.current.apparent_temperature
                  )}
                  °C
                </span>
              </div>
            </div>

            <WeatherIcon
              code={weather.current.weather_code}
              size={56}
            />
          </div>

          <div className="weather-forecast">
            {weather.daily.time.slice(0, 3).map((date, i) => (
              <div className="weather-day" key={date}>
                <span>
                  {i === 0
                    ? "오늘"
                    : i === 1
                      ? "내일"
                      : "모레"}
                </span>

                <WeatherIcon
                  code={weather.daily.weather_code[i]}
                  size={23}
                />

                <strong>
                  {Math.round(
                    weather.daily.temperature_2m_max[i]
                  )}
                  ° /{" "}
                  {Math.round(
                    weather.daily.temperature_2m_min[i]
                  )}
                  °
                </strong>

                <small>
                  비{" "}
                  {weather.daily.precipitation_probability_max[i] ??
                    "-"}
                  %
                </small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
