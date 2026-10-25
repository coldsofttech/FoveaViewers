import styles from './ExampleComponent.module.css';

/**
 * @typedef {object} ExampleComponentProps
 * @property {string} name Who to greet.
 * @property {(name: string) => void} [onGreet] Called with the name when the button is pressed.
 */

/**
 * Shows a greeting and a button that reports the greeted name to the host.
 *
 * @param {ExampleComponentProps} props Component props.
 * @returns {import('react').JSX.Element} The rendered greeting.
 */
export function ExampleComponent({ name, onGreet }) {
  return (
    <div className={styles.root}>
      <p>Hello, {name}!</p>
      <button type="button" onClick={() => onGreet?.(name)}>
        Greet
      </button>
    </div>
  );
}
