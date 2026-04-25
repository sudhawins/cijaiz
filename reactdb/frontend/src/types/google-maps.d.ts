declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options?: MapOptions);
      setCenter(latlng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      panTo(latlng: LatLng | LatLngLiteral): void;
      fitBounds(bounds: LatLngBounds): void;
      getBounds(): LatLngBounds | undefined;
      controls: MVCArray<Node>[];
      addListener(eventName: string, callback: Function): void;
    }

    interface MapOptions {
      zoom?: number;
      center?: LatLng | LatLngLiteral;
      mapTypeControl?: boolean;
      fullscreenControl?: boolean;
      zoomControl?: boolean;
      streetViewControl?: boolean;
    }

    class Marker {
      constructor(options?: MarkerOptions);
    }

    interface MarkerOptions {
      position: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
    }

    class LatLng {
      constructor(lat: number, lng: number);
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLngBounds {
      extend(point: LatLng | LatLngLiteral): void;
    }

    class DirectionsService {
      route(request: DirectionsRequest): Promise<DirectionsResult>;
    }

    interface DirectionsRequest {
      origin: string | LatLng | LatLngLiteral;
      destination: string | LatLng | LatLngLiteral;
      travelMode: TravelMode;
    }

    interface DirectionsResult {
      routes: DirectionsRoute[];
    }

    interface DirectionsRoute {
      [key: string]: any;
    }

    class DirectionsRenderer {
      constructor(options?: DirectionsRendererOptions);
      setDirections(result: DirectionsResult): void;
    }

    interface DirectionsRendererOptions {
      map?: Map;
    }

    enum TravelMode {
      DRIVING = 'DRIVING',
      WALKING = 'WALKING',
      BICYCLING = 'BICYCLING',
      TRANSIT = 'TRANSIT',
    }

    enum ControlPosition {
      TOP_LEFT = 0,
      TOP_CENTER = 1,
      TOP_RIGHT = 2,
      LEFT_CENTER = 3,
      CENTER = 4,
      RIGHT_CENTER = 5,
      BOTTOM_LEFT = 6,
      BOTTOM_CENTER = 7,
      BOTTOM_RIGHT = 8,
    }

    class MVCArray<T> {
      push(element: T): void;
      clear(): void;
      forEach(callback: (element: T) => void): void;
    }

    namespace places {
      class SearchBox {
        constructor(inputElement: HTMLInputElement);
        setBounds(bounds: LatLngBounds): void;
        getPlaces(): PlacesResult[];
        addListener(eventName: string, callback: Function): void;
      }

      interface PlacesResult {
        geometry?: {
          location: LatLng;
          viewport?: LatLngBounds;
        };
        name?: string;
        formatted_address?: string;
      }
    }
  }
}
