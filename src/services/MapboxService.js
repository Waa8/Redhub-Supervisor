const axios = require('axios');

class MapboxService {
  constructor() {
    this.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
    this.baseUrl = 'https://api.mapbox.com';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.accessToken) {
        console.warn('Mapbox access token not configured - mapping features will be disabled');
        return false;
      }

      // Test API connection
      const response = await axios.get(`${this.baseUrl}/geocoding/v5/mapbox.places/test.json`, {
        params: {
          access_token: this.accessToken,
          limit: 1
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('✅ Mapbox service connected successfully');
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Mapbox service initialization failed:', error.message);
      return false;
    }
  }

  // Geocode address to coordinates
  async geocodeAddress(address) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`, {
        params: {
          access_token: this.accessToken,
          limit: 1,
          types: 'address,poi'
        }
      });

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        return {
          address: feature.place_name,
          coordinates: {
            longitude: feature.center[0],
            latitude: feature.center[1]
          },
          confidence: feature.relevance,
          components: {
            street: feature.address || '',
            city: feature.context?.find(c => c.id.includes('place'))?.text || '',
            region: feature.context?.find(c => c.id.includes('region'))?.text || '',
            country: feature.context?.find(c => c.id.includes('country'))?.text || '',
            postcode: feature.context?.find(c => c.id.includes('postcode'))?.text || ''
          }
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error.message);
      return null;
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(longitude, latitude) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/geocoding/v5/mapbox.places/${longitude},${latitude}.json`, {
        params: {
          access_token: this.accessToken,
          limit: 1
        }
      });

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        return {
          address: feature.place_name,
          coordinates: {
            longitude: feature.center[0],
            latitude: feature.center[1]
          },
          components: {
            street: feature.address || '',
            city: feature.context?.find(c => c.id.includes('place'))?.text || '',
            region: feature.context?.find(c => c.id.includes('region'))?.text || '',
            country: feature.context?.find(c => c.id.includes('country'))?.text || '',
            postcode: feature.context?.find(c => c.id.includes('postcode'))?.text || ''
          }
        };
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error.message);
      return null;
    }
  }

  // Calculate route between multiple points
  async calculateRoute(coordinates, profile = 'driving') {
    if (!this.isInitialized || coordinates.length < 2) {
      return null;
    }

    try {
      const coordinatesString = coordinates
        .map(coord => `${coord.longitude},${coord.latitude}`)
        .join(';');

      const response = await axios.get(`${this.baseUrl}/directions/v5/mapbox/${profile}/${coordinatesString}`, {
        params: {
          access_token: this.accessToken,
          geometries: 'geojson',
          overview: 'full',
          steps: true,
          annotations: 'duration,distance'
        }
      });

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          distance: route.distance, // meters
          duration: route.duration, // seconds
          geometry: route.geometry,
          steps: route.legs[0]?.steps || [],
          waypoints: response.data.waypoints
        };
      }

      return null;
    } catch (error) {
      console.error('Route calculation error:', error.message);
      return null;
    }
  }

  // Optimize delivery routes for multiple destinations
  async optimizeDeliveryRoute(depot, destinations, profile = 'driving') {
    if (!this.isInitialized || destinations.length === 0) {
      return null;
    }

    try {
      // Prepare coordinates: depot first, then destinations
      const coordinates = [depot, ...destinations];
      const coordinatesString = coordinates
        .map(coord => `${coord.longitude},${coord.latitude}`)
        .join(';');

      const response = await axios.get(`${this.baseUrl}/optimized-trips/v1/mapbox/${profile}/${coordinatesString}`, {
        params: {
          access_token: this.accessToken,
          source: 'first', // Start from depot
          destination: 'first', // Return to depot
          roundtrip: true,
          geometries: 'geojson',
          overview: 'full'
        }
      });

      if (response.data.trips && response.data.trips.length > 0) {
        const trip = response.data.trips[0];
        return {
          distance: trip.distance, // meters
          duration: trip.duration, // seconds
          geometry: trip.geometry,
          waypoints: response.data.waypoints,
          optimizedOrder: response.data.waypoints.map((wp, index) => ({
            originalIndex: wp.waypoint_index,
            optimizedIndex: index,
            coordinates: {
              longitude: wp.location[0],
              latitude: wp.location[1]
            }
          }))
        };
      }

      return null;
    } catch (error) {
      console.error('Route optimization error:', error.message);
      return null;
    }
  }

  // Get delivery zones based on service area
  async getDeliveryZones(centerPoint, radiusKm = 10) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      // Create isochrone (service area) based on drive time
      const response = await axios.get(`${this.baseUrl}/isochrone/v1/mapbox/driving/${centerPoint.longitude},${centerPoint.latitude}`, {
        params: {
          access_token: this.accessToken,
          contours_minutes: [15, 30, 45, 60], // 15, 30, 45, 60 minute drive times
          polygons: true,
          denoise: 1
        }
      });

      if (response.data.features) {
        return response.data.features.map((feature, index) => ({
          driveTimeMinutes: [15, 30, 45, 60][index],
          geometry: feature.geometry,
          properties: feature.properties
        }));
      }

      return null;
    } catch (error) {
      console.error('Delivery zones calculation error:', error.message);
      return null;
    }
  }

  // Calculate distance matrix for multiple points
  async calculateDistanceMatrix(origins, destinations, profile = 'driving') {
    if (!this.isInitialized || origins.length === 0 || destinations.length === 0) {
      return null;
    }

    try {
      const originCoords = origins.map(coord => `${coord.longitude},${coord.latitude}`).join(';');
      const destCoords = destinations.map(coord => `${coord.longitude},${coord.latitude}`).join(';');

      const response = await axios.get(`${this.baseUrl}/directions-matrix/v1/mapbox/${profile}/${originCoords};${destCoords}`, {
        params: {
          access_token: this.accessToken,
          sources: Array.from({ length: origins.length }, (_, i) => i).join(';'),
          destinations: Array.from({ length: destinations.length }, (_, i) => origins.length + i).join(';'),
          annotations: 'duration,distance'
        }
      });

      return {
        durations: response.data.durations, // seconds
        distances: response.data.distances, // meters
        sources: response.data.sources,
        destinations: response.data.destinations
      };
    } catch (error) {
      console.error('Distance matrix calculation error:', error.message);
      return null;
    }
  }

  // Validate address format
  validateAddress(address) {
    if (!address || typeof address !== 'object') {
      return false;
    }

    const required = ['street', 'city', 'country'];
    return required.every(field => address[field] && address[field].trim().length > 0);
  }

  // Format address for display
  formatAddress(address) {
    if (!this.validateAddress(address)) {
      return 'Invalid Address';
    }

    const parts = [
      address.street,
      address.city,
      address.region,
      address.postcode,
      address.country
    ].filter(part => part && part.trim().length > 0);

    return parts.join(', ');
  }

  // Calculate estimated delivery time based on distance and traffic
  calculateEstimatedDeliveryTime(distanceMeters, currentHour = new Date().getHours()) {
    // Base speed in km/h considering traffic patterns
    let baseSpeed = 40; // km/h

    // Adjust for traffic patterns
    if (currentHour >= 7 && currentHour <= 9) {
      baseSpeed *= 0.6; // Morning rush hour
    } else if (currentHour >= 17 && currentHour <= 19) {
      baseSpeed *= 0.7; // Evening rush hour
    } else if (currentHour >= 12 && currentHour <= 14) {
      baseSpeed *= 0.8; // Lunch hour
    }

    const distanceKm = distanceMeters / 1000;
    const travelTimeHours = distanceKm / baseSpeed;
    const travelTimeMinutes = Math.ceil(travelTimeHours * 60);

    // Add buffer time for loading/unloading
    const bufferMinutes = 15;
    const totalMinutes = travelTimeMinutes + bufferMinutes;

    return {
      estimatedMinutes: totalMinutes,
      estimatedHours: Math.ceil(totalMinutes / 60),
      baseSpeed: baseSpeed,
      trafficFactor: baseSpeed / 40
    };
  }
}

module.exports = new MapboxService();
