/**
 * This is a utility file with the type declaration of the Event function parameters
 */

/**
 * Type of Event Details object. Contains the details of the triggered Event
 */
export interface EventDetails {
    /**
     * Event data
     */
    data: Record<string, unknown>;
    /**
     * Time of the event
     */
    time: number;
    /**
     * Get the project details of the event function
     * @returns project details
     */
    getProjectDetails: () => Record<string, unknown>;
    /**
     * Functional API to get the data of the event
     * @returns event data
     */
    getData: () => Record<string, unknown>;
    /**
     * Functional API to get the raw data of the event function execution.
     * 
     * Useful when the event is from {@link https://docs.catalyst.zoho.com/en/signals/ Catalyst Signals}
     * @returns raw event data
     */
    getRawData: () => Record<string, unknown>;
    /**
     * Functional API to get the time of the event
     * @returns event time
     */
    getTime: () => number;
    /**
     * Get the action that triggered the event
     * @returns action
     */
    getAction: () => string;
    /**
     * Get the source of the event
     * @returns event source
     */
    getSource: () => string;
    /**
     * Get the Id of the entity that triggered the event
     * @returns source entity's Id
     */
    getSourceEntityId: () => string;
    /**
     * Get the details of the event bus
     * @returns event bus details
     */
    getEventBusDetails: () => Record<string, unknown>;
}

/**
 * Type of the Context object of the Event function
 */
export interface Context {
    /**
     * Contains catalyst auth headers (for internal use)
     */
    catalystHeaders: Record<string, string>;
    /**
     * Close the Event function with success response
     * @returns 
     */
    closeWithSuccess: () => void;
    /**
     * Close the Event function failure response
     * @returns 
     */
    closeWithFailure: () => void;
    /**
     * Get the remaining execution time of the Event function
     * @returns remaining execution time in milliseconds
     */
    getRemainingExecutionTimeMs: () => number;
    /**
     * Get the maximum possible execution time of the Event function
     * @returns maximum possible execution time in milliseconds
     */
    getMaxExecutionTimeMs: () => number;
}
