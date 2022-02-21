// Time Log Component
import { useMutation } from "@apollo/client";
import React, { useState } from "react";
import { ADD_LOGGED_TIME } from "../../utils/mutations";

const TimeLog = ({ timeLog, totalHours, taskId }) => {
  const [inputValues, setInputValues] = useState({
    description: "",
    hours: "",
  });
  const [inputErrors, setInputErrors] = useState({
    description: "",
    hours: "",
  });
  const [submitError, setSubmitError] = useState("");

  const [addTime] = useMutation(ADD_LOGGED_TIME);

  const handleChange = (e) => {
    setInputValues({ ...inputValues, [e.target.name]: e.target.value });
  };

  // validate single input and return appropriate validation message
  const validateInput = (inputName, inputValue) => {
    if (inputName === "description" && !inputValue.length) {
      return "Please provide a description.";
    }
    if (inputName === "hours" && !inputValue.length) {
      return "Please please provide a number for hours.";
    }
  };

  // get validation message for single input and display to user
  const updateInputError = (e) => {
    const validationMessage = validateInput(e.target.name, e.target.value);
    setInputErrors({ ...inputErrors, [e.target.name]: validationMessage });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // create object to hold error messages for all inputs
    const updatedInputErrors = {};
    // create variable to indicate if there are input errors
    let inputErrorsExists;

    // loop through each input to validate and retrieve validation msg
    for (let input in inputValues) {
      const errorMsg = validateInput(input, inputValues[input]);
      if (errorMsg) {
        updatedInputErrors[input] = errorMsg;
        inputErrorsExists = true;
      } else {
        updatedInputErrors[input] = "";
      }
    }

    // after running validation on all inputs, udate inputErrors in single funciton call
    setInputErrors({ ...inputErrors, ...updatedInputErrors });

    // only submit if there are no input errors
    if (!inputErrorsExists) {
      try {
        // pass form inputs to add time mutation
        await addTime({
          variables: {
            loggedTimeInputs: {
              description: inputValues.description,
              hours: parseFloat(inputValues.hours) || 0,
              taskId: taskId,
            },
          },
        });
        // clear form
        setInputValues({
          description: "",
          hours: "",
        });
      } catch (e) {
        setSubmitError("Sorry, something went wrong.");
        console.error(e);
      }
    }
  };

  return (
    <div>
      <div>
        <h3>Time Log</h3>
        <p className="fw-bold">{totalHours} total hours logged</p>
        <ul>
          {timeLog.length ? (
            timeLog.map((loggedTime) => (
              <li key={loggedTime._id}>
                <p>{loggedTime.description}</p>
                <p className="fs-italic">{`${loggedTime.hours} on ${loggedTime.date}`}</p>
              </li>
            ))
          ) : (
            <li>No time has been logged on this task, yet.</li>
          )}
        </ul>
      </div>
      <div>
        <form onSubmit={handleFormSubmit}>
          <div>
            <label htmlFor="description" className="w-100 fw-bold">
              Description:
            </label>
            <textarea
              className="w-100 mb-0"
              placeholder="Describe your time entry..."
              name="description"
              value={inputValues.description}
              onChange={handleChange}
            ></textarea>
            {inputErrors.description && (
              <p className="form-error-msg mt-0 pt-0">{inputErrors.description}</p>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="hours" className="w-100 fw-bold">
              Hours:
            </label>
            <input
              className="w-auto"
              placeholder="1.5"
              name="hours"
              type="number"
              step="0.01"
              id="hours"
              value={inputValues.hours}
              onChange={handleChange}
            ></input>
            {inputErrors.hours && (
              <p className="form-error-msg mt-1">{inputErrors.hours}</p>
            )}
          </div>

          {submitError && (
            <div className="my-4">
              <p className="form-error-msg fs-6">{submitError}</p>
            </div>
          )}

          <div className="my-1">
            <button className="btn btn-purple text-white fw-bold" type="submit">
              + Add Time
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeLog;
